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
})
