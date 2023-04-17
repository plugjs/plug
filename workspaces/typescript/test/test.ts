import { find } from '@plugjs/plug'

describe('Typescript Plug', async () => {
  const files = await find('**/*.test.ts', { directory: '@/workspaces/typescript/test' })
  for (const file of files.absolutePaths()) await import(file)
})
