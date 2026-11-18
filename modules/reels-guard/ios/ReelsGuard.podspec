Pod::Spec.new do |s|
  s.name = 'ReelsGuard'
  s.version = '0.3.0'
  s.summary = 'Local iOS Screen Time and ReplayKit bridge for Reels filtr'
  s.description = s.summary
  s.homepage = 'https://github.com/Numsik/Appka-na-schovani-reels-atd...'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'Numsik'
  s.source = { :git => '' }
  s.platforms = { :ios => '16.0' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'ReplayKit', 'SwiftUI'
end
