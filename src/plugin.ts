import BasePlugin from '@appium/base-plugin'
import log from "appium/build/lib/logger";
import multer from "multer";
import * as fs from "node:fs";
import {PackageManager} from "./PackageManager";
import { exec } from 'child_process';

export class PackageDepotPlugin extends BasePlugin {
    public static PackageManager: PackageManager;
    private package: any;

    constructor(pluginName: string, cliArgs: any) {
        super(pluginName, cliArgs);
        log.debug("PackageDepot plugin started");
    }

    async createSession(next: () => any, driver: any, jwpDesCaps: any, jwpReqCaps: any, caps: any){
        log.debug('PackageDepotPlugin createSession hook');

        let package_id: string;
        let app = caps['alwaysMatch']['appium:app'];
        log.debug('Value of appium:app', app)

        if (app && app.startsWith("depot:")) {
            package_id = app.replace("depot:", "");
            this.package = PackageDepotPlugin.PackageManager.getPackage(package_id);
            if (!this.package) {
                throw new Error(`Unable to find package "${package_id}"`);
            } else {
                app = this.package['packagePath'] + '/' + this.package['package']['filename'];
                caps['alwaysMatch']['appium:app'] = app;
                if (this.package.setup) {
                    this.executeScript(this.package.setup["filename"], this.package['packagePath']);
                }
            }
        }

        const result = await next();
        return result;
    }

    async deleteSession(next: () => any, driver: any, sessionId: string) {
        log.debug('PackageDepotPlugin deleteSession hook');

        const result = await next();

        if (this.package && this.package.teardown) {
            this.executeScript(this.package.teardown["filename"], this.package['packagePath']);
        }
        return result;
    }

    private executeScript(path: string, workingDirectory: string) {
        const os = process.platform;
        let command = '';

        if (os === 'win32') {
            command = 'cmd /c ' + path;
        } else {
            command = 'sh ' + path;
        }

        exec(command, { cwd: workingDirectory, }, (error, stdout, stderr) => {
            if (error) {
                log.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                log.error(`stderr: ${stderr}`);
            }
            log.debug(`stdout: ${stdout}`);
        });
    }

    public static async updateServer(
        expressApp: any,
        httpServer: any,
        cliArgs: any
    ): Promise<void> {
        log.info('PackageDepotPlugin updateServer hook');

        const pluginArgs = cliArgs.plugin ?? {};
        const packageDepotArgs = pluginArgs["package-depot"] ?? {};
        const depotDir: string = packageDepotArgs["directory"] ?? "packageDepot/";

        const packagesDir: string = depotDir + "packages/";
        if (!fs.existsSync(packagesDir)) {
            fs.mkdirSync(packagesDir, { recursive: true });
        }

        const tempDir: string = depotDir + "temp/";
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        PackageDepotPlugin.PackageManager = new PackageManager(packagesDir);

        const storage = multer.diskStorage({
            destination: (req: any, file: any, cb) => {
                cb(null, tempDir);
            },
            filename: (req: any, file: any, cb) => {
                cb(null, file.originalname);
            }
        });
        const upload = multer({ storage: storage });

        expressApp.post("/package-depot/add-package", upload.fields([
            { name: "setup", maxCount: 1 },
            { name: "package", maxCount: 1 },
            { name: "teardown", maxCount: 1 }
        ]), (req: any, res: any) => {
           log.debug("PackageDepotPlugin add package endpoint called");

           if (!(req.files && req.files["package"] && req.files["package"][0])) {
               return res.status(400).json({ error: "Package file not provided" });
           }

           const unzip = String(req.query.unzip).toLowerCase() === "true";
           const executablePath = req.query['executable-path'] || '';

           const packageFile = req.files["package"][0];
           const setupFile = req.files["setup"] ? req.files["setup"][0] : null;
           const teardownFile = req.files["teardown"] ? req.files["teardown"][0] : null;

           log.debug("Uploaded package file details: ", packageFile);
           if (setupFile) {
               log.debug("Uploaded setup script details: ", setupFile);
           }
           if (teardownFile) {
               log.debug("Uploaded teardown script details: ", teardownFile);
           }

           const packageId: string = PackageDepotPlugin.PackageManager.addPackage(
               setupFile,
               packageFile,
               teardownFile,
               unzip,
               executablePath
           );

           return res.status(200).json({
               message: "Files uploaded successfully",
               packageId: packageId,
           });
        });

        expressApp.delete('/package-depot/remove', (req: any, res: any) => {
            log.debug("PackageDepotPlugin remove package endpoint called");

            const packageId: string = req.body.packageId;
            if (!packageId) {
                return res.status(400).json({ error: "PackageId is required" });
            }
            try {
                PackageDepotPlugin.PackageManager.removePackage(packageId);
                log.debug(`Package ${packageId} removed successfully`);
                return res.status(200).json({ message: `Package ${packageId} removed successfully` });
            } catch (error: any) {
                log.error(`Error while depot plugin remove package: ${error.message}`);
                return res.status(500).json({ error: error.message });
            }
        })
    }
}