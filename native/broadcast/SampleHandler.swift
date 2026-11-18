import ReplayKit
import Vision
import ImageIO
import FamilyControls

final class SampleHandler: RPBroadcastSampleHandler {
    private let lock = NSLock()
    private var store: GuardStore?
    private var gate = DetectionGate()
    private var lastFrame: TimeInterval = 0
    private var timer: DispatchSourceTimer?

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        lock.lock(); defer { lock.unlock() }
        guard let store = GuardStore.open(), store.enabled,
              AuthorizationCenter.shared.authorizationStatus == .approved,
              store.selection?.applicationTokens.count == 1 else {
            finishBroadcastWithError(NSError(domain: "ReelsFiltr", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "V aplikaci nejdřív povol ochranu a vyber Instagram."]))
            return
        }
        self.store = store
        store.removeShield()
        store.heartbeat = Date().timeIntervalSince1970
        store.broadcasting = true
        store.graceUntil = Date().timeIntervalSince1970 + 4
        gate.reset()
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue(label: "cz.numsik.reelsfiltr.heartbeat"))
        timer.schedule(deadline: .now() + 1, repeating: 1)
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            self.lock.lock(); defer { self.lock.unlock() }
            guard let store = self.store, store.broadcasting else { return }
            store.heartbeat = Date().timeIntervalSince1970
            store.refresh()
            if AuthorizationCenter.shared.authorizationStatus != .approved { store.stopSession() }
        }
        self.timer = timer
        timer.resume()
    }

    override func broadcastPaused() { stopSession() }

    override func broadcastResumed() {
        // A new broadcast requires an explicit start after a pause. This avoids
        // displaying an active state while no frames are being analyzed.
        finishBroadcastWithError(NSError(domain: "ReelsFiltr", code: 2,
            userInfo: [NSLocalizedDescriptionKey: "Vysílání bylo přerušeno. Spusť ho prosím znovu v Reels filtru."]))
    }

    override func broadcastFinished() { stopSession() }

    private func stopSession() {
        lock.lock(); defer { lock.unlock() }
        timer?.cancel()
        timer = nil
        store?.stopSession()
        store = nil
        gate.reset()
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video else { return }
        lock.lock(); defer { lock.unlock() }
        let now = Date().timeIntervalSince1970
        guard now - lastFrame >= 1.1, let store else { return }
        lastFrame = now
        store.refresh(at: now)
        guard store.enabled, store.broadcasting, store.blockedUntil == 0, now >= store.graceUntil,
              AuthorizationCenter.shared.authorizationStatus == .approved,
              let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { gate.reset(); return }
        autoreleasepool {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = false
            let supported = (try? request.supportedRecognitionLanguages()) ?? ["en-US"]
            request.recognitionLanguages = ["en-US", "cs-CZ"].filter { supported.contains($0) }
            request.automaticallyDetectsLanguage = true
            request.minimumTextHeight = 0.008
            let raw = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString,
                                      attachmentModeOut: nil) as? NSNumber
            let orientation = CGImagePropertyOrientation(rawValue: raw?.uint32Value ?? 1) ?? .up
            do {
                try VNImageRequestHandler(cvPixelBuffer: buffer, orientation: orientation).perform([request])
                let texts = (request.results ?? []).compactMap { observation -> ScreenText? in
                    guard let candidate = observation.topCandidates(1).first else { return nil }
                    let box = observation.boundingBox
                    return ScreenText(text: candidate.string, confidence: Double(candidate.confidence),
                        x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
                }
                if gate.observe(matches: ReelsDetection.matches(texts), at: now) {
                    store.block(at: now)
                    gate.reset()
                }
            } catch { gate.reset() }
        }
    }
}
