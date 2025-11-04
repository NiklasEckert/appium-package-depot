import multer from 'multer';
import { getLogger } from '../logger';
import { PackageManager } from "../package-manager";
import { Application } from 'express';

export class Endpoints {
    private readonly upload: multer.Multer;
    private packageManager: PackageManager;

    private static PACKAGE_DEPOT_PATH = "/package-depot/";

    constructor(tempDir: string, packageManager: PackageManager) {
        const storage = multer.diskStorage({
            destination: (_req: any, _file: any, cb: any)=>  {
                cb(null, tempDir);
            },
            filename: (_req: any, file: any, cb: any) => {
                cb(null, file.originalname);
            }
        })
        this.upload = multer({ storage });
        this.packageManager = packageManager;
    }

    public register(expressApp: Application): void {
        const log = getLogger('register-endpoints');

        const packagesPath = Endpoints.PACKAGE_DEPOT_PATH + 'packages';
        const addPackagePath = Endpoints.PACKAGE_DEPOT_PATH + 'add-package';
        const removePackagePath = Endpoints.PACKAGE_DEPOT_PATH + 'remove-package';

        expressApp.get(packagesPath, this.getPackages.bind(this));

        expressApp.post(addPackagePath, this.upload.fields([
            { name: 'setup', maxCount: 1 },
            { name: 'package', maxCount: 1 },
            { name: 'teardown', maxCount: 1 }
        ]), this.addPackage.bind(this));

        expressApp.delete(removePackagePath, this.removePackage.bind(this));

        log.info('Registered the following endpoints:', [
            addPackagePath,
            removePackagePath
        ])
    }

    private getPackages(req: any, res: any): any {
        const log = getLogger('packages');
        log.debug('Endpoints:getPackages called');

        const packageId = req.query.packageId;
        if (packageId) {
            const packageInfo = this.packageManager.getPackage(packageId);

            if (!packageInfo) {
                return res.status(500).json({ error: `Package ${packageId} not found` });
            }

            return res.status(200).send(packageInfo);
        }

        const packages = this.packageManager.getPackages();
        return res.status(200).send(packages);
    }

    private addPackage(req: any, res: any): any {
        const log = getLogger('add-package');
        log.debug('Endpoints add package endpoint called');

        if (!(req.files && req.files['package'] && req.files['package'][0])) {
            log.error('Package file not provided');
            return res.sendStatus(400).json({ error: 'Package file not provided'});
        }

        const unzip = String(req.query.unzip).toLowerCase() === 'true';
        const executablePath = req.query['executable-path']
            ? req.query['executable-path'] !== '' ? req.query['executable-path'] : null
            : null;

        const packageFile = req.files['package'][0];
        const setupFile = req.files['setup'] ? req.files['setup'][0] : null;
        const teardownFile = req.files['teardown'] ? req.files['teardown'][0] : null;

        log.debug('Uploaded package file details: ', packageFile);
        if (setupFile) {
            log.debug('Uploaded setup script details: ', setupFile);
        }
        if (teardownFile) {
            log.debug('Uploaded teardown script details: ', teardownFile);
        }

        const packageId: string = this.packageManager.addPackage(
            setupFile,
            packageFile,
            teardownFile,
            unzip,
            executablePath
        );

        log.info(`Package ${packageFile.filename} successfully uploaded and saved as package with id ${packageId}`);
        return res.status(200).json({
            message: 'Package depot successfully uploaded',
            packageId: packageId
        })
    }

    private removePackage(req: any, res: any): any {
        const log = getLogger('remove-package');
        log.debug('Endpoints remove package endpoint called');

        const packageId: string = req.query.packageId as string;
        if (!packageId) {
            return res.status(400).json({
                error: 'PackageId is required',
            });
        }

        try {
            this.packageManager.removePackage(packageId);
            log.info(`Package ${packageId} removed successfully`);
            return res.status(200).json({ message: `Package ${packageId} removed successfully` });
        } catch (error: any) {
            log.error(`Error while removing package: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }
    }
}