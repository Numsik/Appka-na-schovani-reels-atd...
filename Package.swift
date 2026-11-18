// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ReelsDetection",
    products: [.library(name: "ReelsDetection", targets: ["ReelsDetection"])],
    targets: [
        .target(name: "ReelsDetection", path: "modules/reels-guard/ios/Shared",
                exclude: ["GuardStore.swift"], sources: ["ReelsDetection.swift"]),
        .testTarget(name: "ReelsDetectionTests", dependencies: ["ReelsDetection"], path: "tests/native"),
    ]
)
