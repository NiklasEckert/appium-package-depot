import fs from 'fs';
import path from 'path';
import log from "appium/build/lib/logger";

export class PackageManager {
    private packages: { [key: string]: any };
    private readonly packagesDir: string;

    public constructor(packagesDir: string) {
        this.packagesDir = packagesDir;
        this.packages = {};

        this.loadPackages();
    }

    public getPackagesDir(): string {
        return this.packagesDir;
    }

    private loadPackages(): void {
        const dirs = fs.readdirSync(this.packagesDir, { withFileTypes: true });
        const newPackages: { [key: string]: any } = {};

        for (const dirent of dirs) {
            if (dirent.isDirectory()) {
                const packageDir = path.join(this.packagesDir, dirent.name);
                const metadataPath = path.join(packageDir, 'metadata.json');

                if (fs.existsSync(metadataPath)) {
                    try {
                        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
                        const metadata = JSON.parse(metadataContent);
                        newPackages[metadata["id"]] = metadata;
                    } catch (error) {
                        console.error(`Failed to load package from ${metadataPath}:`, error);
                    }
                }
            }
        }

        this.packages = newPackages;
    }

    public addPackage(
        setupFile: any,
        packageFile: any,
        teardownFile: any,
        unzip: boolean,
        executablePath: string
    ): string {
        const uniqueFolderName = Date.now().toString() + '-' + Math.floor(Math.random() * 10000).toString();
        const destFolder = path.join(this.packagesDir, uniqueFolderName);

        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }

        if (!packageFile) {
            throw new Error('Package file required.');
        }

        let metadata: any = {};
        metadata["id"] = uniqueFolderName;
        metadata["name"] = packageFile.originalname;
        metadata["packagePath"] = this.packagesDir + uniqueFolderName + "/";

        if (setupFile) {
            const destPath = path.join(destFolder, setupFile.originalname);
            fs.renameSync(setupFile.path, destPath);

            metadata['setup'] = {
                filename: setupFile.originalname,
                relativePath: path.join(uniqueFolderName, setupFile.originalname)
            };
        }

        const destPath = path.join(destFolder, packageFile.originalname);
        fs.renameSync(packageFile.path, destPath);

        log.info("UNZIP " + unzip);
        log.info("Executable " + executablePath);
        if (unzip) {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(destPath);
            zip.extractAllTo(destFolder, true);
        }

        metadata['package'] = {
            filename: packageFile.originalname,
            relativePath: executablePath ? path.join(uniqueFolderName, executablePath) : path.join(uniqueFolderName, packageFile.originalname)
        };

        if (teardownFile) {
            const destPath = path.join(destFolder, teardownFile.originalname);
            fs.renameSync(teardownFile.path, destPath);
            metadata['teardown'] = {
                filename: teardownFile.originalname,
                relativePath: path.join(uniqueFolderName, teardownFile.originalname)
            };
        }

        const metadataPath = path.join(destFolder, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

        this.packages[uniqueFolderName] = metadata;
        return uniqueFolderName;
    }

    public getPackages(): { [key: string]: any } {
        return this.packages;
    }

    public getPackage(package_id: string) {
        log.info('Search for package', package_id);
        return this.packages[package_id];
    }

    public removePackage(package_id: string) {
        const packageData = this.packages[package_id];
        if (!packageData) {
            throw new Error(`Package with id ${package_id} not found`);
        }
        const packageDir = path.join(this.packagesDir, package_id);
        if (fs.existsSync(packageDir)) {
            fs.rmSync(packageDir, { recursive: true });
        }
        delete this.packages[package_id];
        return true;
    }
}