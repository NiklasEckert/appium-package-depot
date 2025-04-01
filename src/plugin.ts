import BasePlugin from '@appium/base-plugin'
import * as fs from "node:fs";
import {PackageManager} from "./PackageManager";
import { exec } from 'child_process';
import {getLogger} from "./logger";
import {PackageDepotEndpoints} from "./api/PackageDepotEndpoints";

export class PackageDepotPlugin extends BasePlugin {
    public static PackageManager: PackageManager;
    private package: any;
    private logg: any = getLogger("Plugin");

    constructor(pluginName: string, cliArgs: any) {
        super(pluginName, cliArgs);
        this.logg.debug("PackageDepot plugin started");
    }

    async createSession(next: () => any, driver: any, jwpDesCaps: any, jwpReqCaps: any, caps: any){
        this.logg.debug('PackageDepotPlugin createSession hook');

        let package_id: string;
        let app = caps['alwaysMatch']['appium:app'];
        this.logg.debug('Value of appium:app', app)

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
        this.logg.debug('PackageDepotPlugin deleteSession hook');

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
                this.logg.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                this.logg.error(`stderr: ${stderr}`);
            }
            this.logg.debug(`stdout: ${stdout}`);
        });
    }

    public static async updateServer(
        expressApp: any,
        httpServer: any,
        cliArgs: any
    ): Promise<void> {
        const log = getLogger("updateServer");
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

        const endpoints = new PackageDepotEndpoints(tempDir, PackageDepotPlugin.PackageManager);
        endpoints.register(expressApp);
    }
}