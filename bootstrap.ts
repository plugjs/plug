import build from './build'
import { log } from './src'

build.default()
    .then(() => log.info('All done!'))
    .catch((error) => log.error('Build error', error))
