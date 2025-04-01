import { logger } from '@appium/support';

export const getLogger = (submodule: string) => {
    return logger.getLogger(`package-depot:${ submodule }`)
}