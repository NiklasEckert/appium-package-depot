# appium-package-depot

[![npm version](https://img.shields.io/npm/v/appium-package-depot)](https://www.npmjs.com/package/appium-package-depot)
[![npm downloads](https://img.shields.io/npm/dm/appium-package-depot)](https://www.npmjs.com/package/appium-package-depot)

The **Appium Package Depot** allows you to upload app packages (e.g. `.apk`, `.ipa`, `.app`, or `.zip`) directly to an Appium 2.x.x server instance. These packages are stored server-side and assigned a unique ID. Test sessions can then refer to these packages by specifying `"app": "depot:PACKAGE_ID"` in the Desired Capabilities.

## Features

- Upload app packages for server-side storage
- Optionally unzip uploaded `.zip` files
- Define `setup` and `teardown` scripts per package
- Use packages via simple capabilities like `"app": "depot:PACKAGE_ID"`
- Platform-agnostic (Android, iOS, Windows, etc.)

## ⚠️ Critical Security Warning

> **WARNING:** This plugin executes optional `setup` and `teardown` scripts **directly on the Appium server machine**. These scripts may contain arbitrary shell commands and **pose a significant security risk** if misused.
>
> Additionally, **the plugin exposes unauthenticated HTTP endpoints** for uploading, listing, and removing packages. **Do not expose the Appium server to untrusted networks.**
>
> **Only use this plugin in isolated, trusted, and secure environments!**

## Installation

```bash
appium plugin install --source=npm appium-package-depot
```

## Activation

Run Appium with the following plugin and storage path configuration:

```bash
appium --use-plugins=package-depot --plugin-package-depot-dir=/path/to/package/depot/dir/
```

## Usage

### 1. Upload a Package

```bash
curl --location 'http://${APPIUM_SERVER_URL}/package-depot/add-package?unzip=true&executable-path=ExampleApp.app' \
--header 'Content-Type: multipart/form-data' \
--form 'setup=@"/path/to/setup.sh"' \
--form 'package=@"/path/to/ExampleApp.zip"' \
--form 'teardown=@"/path/to/teardown.sh"'
```

Only `package` is required. All other fields are optional.

**Example Response:**

```json
{
  "message": "Package depot successfully uploaded",
  "packageId": "1743542085618-1051"
}
```

### 2. Use the Package in a Test

```json
{
  "platformName": "ios",
  "automationName": "xcuitest",
  "app": "depot:1743542085618-1051"
}
```

### 3. Remove a Package

```bash
curl --location --request DELETE 'http://${APPIUM_SERVER_URL}/package-depot/remove-package?packageId=1743542085618-1051'
```

**Example Response:**

```json
{
  "message": "Package 1743542085618-1051 removed successfully"
}
```

### 4. Get all loaded Packages

```bash
curl --location 'http://${APPIUM_SERVER_URL}/package-depot/packages/'
```

**Example Response:**

```json
{
  "1762214966168-7472": {
    "id": "1762214966168-7472",
    "name": "TestPackage.zip",
    "packagePath": "packageDepot/packages/1762214966168-7472",
    "package": {
      "filename": "TestPackage.zip",
      "relativePath": "TestPackage.app"
    }
  }
}
```

### 5. Get a single Package

```bash
curl --location 'http://${APPIUM_SERVER_URL}/package-depot/packages/?packageId=1762214966168-7472'
```

**Example Response:**

```json
{
  "id": "1762214966168-7472",
  "name": "TestPackage.zip",
  "packagePath": "packageDepot/packages/1762214966168-7472",
  "package": {
    "filename": "TestPackage.zip",
    "relativePath": "TestPackage.app"
  }
}
```

## Configuration Options

| Option                       | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `--plugin-package-depot-dir` | Path to the directory where uploaded packages are stored |

## License

[MIT License](./LICENSE)
