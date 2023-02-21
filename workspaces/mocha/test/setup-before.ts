import { log } from '@plugjs/plug'

log('Setting up before test')
;(<any> globalThis)['__testing__'] = Date.now()
