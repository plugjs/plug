import { find } from '@plugjs/plug'

describe('Plug Build System', async () => {
  describe('core', async () => {
    const files = await find('*.test.ts', { directory: '@/workspaces/plug/test' })
    for (const file of files.absolutePaths()) await import(file)
  })

  describe('logging', async () => {
    const files = await find('*.test.ts', { directory: '@/workspaces/plug/test/logging' })
    for (const file of files.absolutePaths()) await import(file)
  })

  describe('utilities', async () => {
    const files = await find('*.test.ts', { directory: '@/workspaces/plug/test/utils' })
    for (const file of files.absolutePaths()) await import(file)
  })
})
