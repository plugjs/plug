import { Plug } from '../src/pipe'
import { Project } from '../src/project'
import { Run } from '../src/run'
import { Task } from '../src/task'
import { expect } from 'chai'

describe('Run', () => {
  const task1: Task = { run() {} } as any
  const task2: Task = { run() {} } as any // this has no name
  const project = new Project({ task1 }, '/foo/build.ts' as any, '/foo' as any)

  it('should create a new run', () => {
    const run0 = new Run(project)
    const run1 = new Run(project).for(task1)
    const run2 = new Run(project).for(task2)

    expect(run0.tasks).to.be.an('array').with.length(0)
    expect(run1.tasks).to.be.an('array').with.length(1)
    expect(run2.tasks).to.be.an('array').with.length(1)

    expect(run1.tasks[0]).to.equal(task1)
    expect(run2.tasks[0]).to.equal(task2)

    expect(() => run0.fail())
        .to.throw(/^Build failed$/)
        .with.property('name', 'Failure')
    expect(() => run0.fail('Message...'))
        .to.throw(/^Build failed: Message...$/)
        .with.property('name', 'Failure')
    expect(() => run1.fail())
        .to.throw(/^Task "task1" failed$/)
        .with.property('name', 'Failure')
    expect(() => run1.fail('Message...'))
        .to.throw(/^Task "task1" failed: Message...$/)
        .with.property('name', 'Failure')
    expect(() => run2.fail())
        .to.throw(/^Task "unknown" failed$/)
        .with.property('name', 'Failure')
    expect(() => run2.fail('Message...'))
        .to.throw(/^Task "unknown" failed: Message...$/)
        .with.property('name', 'Failure')
  })

  it('should derive a new run for another task', () => {
    const run1 = new Run(project).for(task1)
    const run2 = run1.for(task2)

    expect(run1.tasks).to.be.an('array').with.length(1)
    expect(run2.tasks).to.be.an('array').with.length(2)

    expect(run1.tasks[0]).to.equal(task1)
    expect(run2.tasks[0]).to.equal(task1)
    expect(run2.tasks[1]).to.equal(task2)
  })

  it('should prepare and cache logs', () => {
    const run = new Run(project)

    const runLog1 = run.log()
    const runLog2 = run.log()
    expect(runLog1).to.equal(runLog2)
    expect(runLog1).to.be.a('function')

    const plug1: Plug = { process: (i) => i }
    const plug2: Plug = { process: (i) => i }
    const plugLog1A = run.log(plug1)
    const plugLog1B = run.log(plug1)
    const plugLog2A = run.log(plug2)
    const plugLog2B = run.log(plug2)
    expect(plugLog1A).to.equal(plugLog1B)
    expect(plugLog2A).to.equal(plugLog2B)
    expect(plugLog1A).not.to.equal(plugLog2B)
    expect(plugLog1A).to.be.a('function')
    expect(plugLog2A).to.be.a('function')
  })

  it('should correctly cache objects in runs', () => {
    const taskX: Task = { run() {} } as any

    const run = new Run(project)
    const run1 = run.for(task1)
    const run2 = run.for(task2)
    const runX = run1.for(taskX)

    const cache: any = run.cache
    const cache1: any = run1.cache
    const cache2: any = run2.cache
    const cacheX: any = runX.cache

    cache['A'] = 'AA'
    cache1['B'] = 'BB'
    cache2['A'] = 'YY' // override from "cache"
    cache2['C'] = 'CC'
    cacheX['D'] = 'DD'

    expect('A' in cache).to.be.true
    expect('B' in cache).to.be.false
    expect('C' in cache).to.be.false
    expect('D' in cache).to.be.false
    expect(cache['A']).to.equal('AA')
    expect(cache['B']).to.be.undefined
    expect(cache['C']).to.be.undefined
    expect(cache['D']).to.be.undefined

    expect('A' in cache1).to.be.false
    expect('B' in cache1).to.be.true
    expect('C' in cache1).to.be.false
    expect('D' in cache1).to.be.false
    expect(cache1['A']).to.equal('AA') // inheruted
    expect(cache1['B']).to.equal('BB')
    expect(cache1['C']).to.be.undefined
    expect(cache1['D']).to.be.undefined

    expect('A' in cache2).to.be.true
    expect('B' in cache2).to.be.false
    expect('C' in cache2).to.be.true
    expect('D' in cache2).to.be.false

    expect(cache2['A']).to.equal('YY') // overridden
    expect(cache2['B']).to.be.undefined
    expect(cache2['C']).to.equal('CC')
    expect(cache2['D']).to.be.undefined

    expect('A' in cacheX).to.be.false
    expect('B' in cacheX).to.be.false
    expect('C' in cacheX).to.be.false
    expect('D' in cacheX).to.be.true

    expect(cacheX['A']).to.equal('AA') // not overridden
    expect(cacheX['B']).to.equal('BB')
    expect(cacheX['C']).to.be.undefined
    expect(cacheX['D']).to.equal('DD') // from cacheX
  })
})
