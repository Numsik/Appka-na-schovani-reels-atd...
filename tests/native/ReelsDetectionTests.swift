import XCTest
@testable import ReelsDetection

final class ReelsDetectionTests: XCTestCase {
    private func region(_ text: String, x: Double = 0.08, y: Double, confidence: Double = 0.95) -> ScreenText {
        ScreenText(text: text, confidence: confidence, x: x, y: y, width: 0.15, height: 0.025)
    }
    private var rail: [ScreenText] {
        [region("12,3 tis.", x: 0.84, y: 0.4), region("123", x: 0.84, y: 0.53), region("452", x: 0.84, y: 0.68)]
    }
    func testPlayerRequiresTitleAndRail() {
        XCTAssertTrue(ReelsDetection.matches([region("Reels", y: 0.09)] + rail))
        XCTAssertFalse(ReelsDetection.matches([region("Reels", y: 0.09)]))
    }
    func testBottomReelsTabDoesNotTrigger() {
        XCTAssertFalse(ReelsDetection.matches([region("Reels", y: 0.95)] + rail))
    }
    func testOrdinaryFeedOrDMDoesNotTrigger() {
        XCTAssertFalse(ReelsDetection.matches([region("Instagram", y: 0.08), region("Reels", y: 0.5)] + rail))
    }
    func testFeedTabsRequirePlayerContext() {
        let tabs = [region("Pro tebe", y: 0.1), region("Přátelé", x: 0.45, y: 0.1)]
        XCTAssertFalse(ReelsDetection.matches(tabs + rail))
        XCTAssertTrue(ReelsDetection.matches(tabs + rail + [region("Původní zvuk", y: 0.86)]))
    }
    func testLowConfidenceAndHorizontalCountsDoNotTrigger() {
        XCTAssertFalse(ReelsDetection.matches([region("Reels", y: 0.1, confidence: 0.3)] + rail))
        XCTAssertFalse(ReelsDetection.matches([region("Reels", y: 0.09)] + [0.3, 0.5, 0.8].map { region("123", x: $0, y: 0.7) }))
    }
    func testNeedsThreeConsecutiveFrames() {
        var gate = DetectionGate()
        XCTAssertFalse(gate.observe(matches: true, at: 0))
        XCTAssertFalse(gate.observe(matches: false, at: 1))
        XCTAssertFalse(gate.observe(matches: true, at: 2))
        XCTAssertFalse(gate.observe(matches: true, at: 3))
        XCTAssertTrue(gate.observe(matches: true, at: 4))
    }
    func testGapsAndClockChangesResetEvidence() {
        var gate = DetectionGate()
        XCTAssertFalse(gate.observe(matches: true, at: 10))
        XCTAssertFalse(gate.observe(matches: true, at: 11))
        XCTAssertFalse(gate.observe(matches: true, at: 20))
        XCTAssertFalse(gate.observe(matches: true, at: 19))
        gate.reset()
        XCTAssertFalse(gate.observe(matches: true, at: 20))
    }
}
