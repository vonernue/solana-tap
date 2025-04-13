const {
  withAndroidManifest,
  withDangerousMod,
  withPlugins,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const AID_XML_FILENAME = "aid_list.xml";
const AID_XML_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
                   android:description="@string/app_name"
                   android:requireDeviceUnlock="false">
  <aid-group android:category="other"
             android:description="@string/app_name">
    <aid-filter android:name="D2760000850101" />
  </aid-group>
</host-apdu-service>`;

const withHceAidXml = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = path.join(config.modRequest.projectRoot, "android", "app", "src", "main", "res", "xml");

      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const xmlPath = path.join(xmlDir, AID_XML_FILENAME);
      fs.writeFileSync(xmlPath, AID_XML_CONTENT, "utf-8");

      return config;
    },
  ]);
};

const withHceManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;

    manifest.manifest["uses-permission"] = manifest.manifest["uses-permission"] || [];
    manifest.manifest["uses-permission"].push({
      $: { "android:name": "android.permission.NFC" },
    });

    manifest.manifest["uses-feature"] = manifest.manifest["uses-feature"] || [];
    manifest.manifest["uses-feature"].push({
      $: {
        "android:name": "android.hardware.nfc.hce",
        "android:required": "true",
      },
    });

    const app = manifest.manifest.application[0];
    app.service = app.service || [];

    app.service.push({
      $: {
        "android:name": "com.reactnativehce.services.CardService",
        "android:exported": "true",
        "android:enabled": "true",
        "android:permission": "android.permission.BIND_NFC_SERVICE",
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.nfc.cardemulation.action.HOST_APDU_SERVICE" } },
          ],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        },
      ],
      "meta-data": [
        {
          $: {
            "android:name": "android.nfc.cardemulation.host_apdu_service",
            "android:resource": `@xml/${AID_XML_FILENAME.replace(".xml", "")}`,
          },
        },
      ],
    });

    return config;
  });
};

const withNfcHcePlugin = (config) => {
  return withPlugins(config, [withHceAidXml, withHceManifest]);
};

module.exports = withNfcHcePlugin;
