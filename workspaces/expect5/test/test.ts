import { find } from '@plugjs/plug'

describe('Expect5 Plug', async () => {
  const files = await find('**/*.test.ts', { directory: '@/workspaces/expect5/test' })
  for (const file of files.absolutePaths()) await import(file)
})
