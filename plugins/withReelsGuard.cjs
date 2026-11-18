const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { withInfoPlist, withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');

function addExtension(project, iosRoot, spec, bundleId, group, version) {
  const folder = path.join(iosRoot, spec.name);
  fs.mkdirSync(folder, { recursive: true });
  for (const [destination, source] of Object.entries(spec.sources)) {
    fs.copyFileSync(path.resolve(iosRoot, '..', source), path.join(folder, destination));
  }
  fs.writeFileSync(path.join(folder, 'Info.plist'), plist.build({
    CFBundleDisplayName: 'Reels filtr', CFBundleExecutable: '$(EXECUTABLE_NAME)',
    CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleInfoDictionaryVersion: '6.0',
    CFBundleName: '$(PRODUCT_NAME)', CFBundlePackageType: 'XPC!',
    CFBundleShortVersionString: version, CFBundleVersion: '1',
    ReelsNativeBlockingEnabled: true, ReelsAppGroup: group,
    NSExtension: {
      NSExtensionPointIdentifier: spec.extensionPoint,
      NSExtensionPrincipalClass: `$(PRODUCT_MODULE_NAME).${spec.principalClass}`,
      ...(spec.name === 'ReelsBroadcast'
        ? { NSExtensionAttributes: { RPBroadcastProcessMode: 'RPBroadcastProcessModeSampleBuffer' } } : {}),
    },
  }));
  fs.writeFileSync(path.join(folder, `${spec.name}.entitlements`), plist.build({
    'com.apple.developer.family-controls': true,
    ...(spec.name === 'ReelsBroadcast' ? { 'com.apple.security.application-groups': [group] } : {}),
  }));
  const existing = Object.entries(project.pbxNativeTargetSection()).find(([key, target]) =>
    !key.endsWith('_comment') && String(target.name).replaceAll('"', '') === spec.name);
  const target = existing ? { uuid: existing[0], pbxNativeTarget: existing[1] }
    : project.addTarget(spec.name, 'app_extension', spec.name, `${bundleId}.${spec.suffix}`);
  if (!existing) {
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    const filesGroup = project.addPbxGroup([], spec.name, spec.name);
    project.addToPbxGroup(filesGroup.uuid, project.getFirstProject().firstProject.mainGroup);
    for (const file of Object.keys(spec.sources)) project.addSourceFile(file, { target: target.uuid }, filesGroup.uuid);
  }
  const list = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  for (const ref of list.buildConfigurations) {
    Object.assign(project.pbxXCBuildConfigurationSection()[ref.value].buildSettings, {
      PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}.${spec.suffix}"`,
      INFOPLIST_FILE: `"${spec.name}/Info.plist"`,
      CODE_SIGN_ENTITLEMENTS: `"${spec.name}/${spec.name}.entitlements"`,
      CODE_SIGN_STYLE: 'Automatic', IPHONEOS_DEPLOYMENT_TARGET: '16.0', TARGETED_DEVICE_FAMILY: '1',
      SWIFT_VERSION: '5.0', APPLICATION_EXTENSION_API_ONLY: 'YES', CLANG_ENABLE_MODULES: 'YES',
      GENERATE_INFOPLIST_FILE: 'NO', SKIP_INSTALL: 'YES', CURRENT_PROJECT_VERSION: '1', MARKETING_VERSION: version,
    });
  }
}

module.exports = function withReelsGuard(config, { enabled = false } = {}) {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) throw new Error('Reels filtr needs ios.bundleIdentifier.');
  const group = `group.${bundleId}`;
  config = withInfoPlist(config, mod => {
    mod.modResults.ReelsNativeBlockingEnabled = enabled;
    if (enabled) mod.modResults.ReelsAppGroup = group;
    else delete mod.modResults.ReelsAppGroup;
    return mod;
  });
  config = withEntitlementsPlist(config, mod => {
    if (enabled) {
      mod.modResults['com.apple.developer.family-controls'] = true;
      mod.modResults['com.apple.security.application-groups'] = [...new Set([
        ...(mod.modResults['com.apple.security.application-groups'] ?? []), group,
      ])];
    } else {
      delete mod.modResults['com.apple.developer.family-controls'];
      const groups = (mod.modResults['com.apple.security.application-groups'] ?? []).filter(value => value !== group);
      if (groups.length) mod.modResults['com.apple.security.application-groups'] = groups;
      else delete mod.modResults['com.apple.security.application-groups'];
    }
    return mod;
  });
  return withXcodeProject(config, mod => {
    const project = mod.modResults;
    if (!enabled) {
      if (Object.values(project.pbxNativeTargetSection()).some(target => typeof target === 'object'
        && ['ReelsBroadcast', 'ReelsShield'].includes(String(target.name).replaceAll('"', '')))) {
        throw new Error('Switching to preview requires: npx expo prebuild --clean --platform ios');
      }
      return mod;
    }
    addExtension(project, mod.modRequest.platformProjectRoot, {
      name: 'ReelsBroadcast', suffix: 'broadcast',
      extensionPoint: 'com.apple.broadcast-services-upload', principalClass: 'SampleHandler',
      sources: {
        'SampleHandler.swift': 'native/broadcast/SampleHandler.swift',
        'GuardStore.swift': 'modules/reels-guard/ios/Shared/GuardStore.swift',
        'ReelsDetection.swift': 'modules/reels-guard/ios/Shared/ReelsDetection.swift',
      },
    }, bundleId, group, config.version ?? '0.3.0');
    addExtension(project, mod.modRequest.platformProjectRoot, {
      name: 'ReelsShield', suffix: 'shield',
      extensionPoint: 'com.apple.ManagedSettingsUI.shield-configuration-service', principalClass: 'ShieldConfigurationExtension',
      sources: { 'ShieldConfiguration.swift': 'native/shield/ShieldConfiguration.swift' },
    }, bundleId, group, config.version ?? '0.3.0');
    return mod;
  });
};
