Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'ProstCounter lock-screen drink counter'
  s.description    = 'Starts, updates and ends the ProstCounter Live Activity'
  s.author         = 'ProstCounter'
  s.homepage       = 'https://prostcounter.fun'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.swift_version = '5.9'
end
