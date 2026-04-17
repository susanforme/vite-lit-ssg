import { describe, it, expect } from 'vitest'

function getFlagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === flag) {
      const val = args[i + 1]
      if (val && !val.startsWith('-')) return val
    } else if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1)
    }
  }
  return undefined
}

function findCommand(args: string[]): string {
  const flagValues = new Set<string>()
  for (const flag of ['--mode', '--config']) {
    const val = getFlagValue(args, flag)
    if (val) flagValues.add(val)
  }
  return args.find((a) => !a.startsWith('-') && !flagValues.has(a)) ?? 'build'
}

describe('CLI arg parsing', () => {
  it('finds "build" command at start', () => {
    expect(findCommand(['build'])).toBe('build')
  })

  it('finds "build" command after flags', () => {
    expect(findCommand(['--mode', 'production', 'build'])).toBe('build')
  })

  it('finds "build" command before flags', () => {
    expect(findCommand(['build', '--mode', 'production'])).toBe('build')
  })

  it('defaults to "build" with no args', () => {
    expect(findCommand([])).toBe('build')
  })

  it('does not confuse flag value with command', () => {
    expect(findCommand(['--mode', 'staging', 'build'])).toBe('build')
  })

  it('getFlagValue reads space-separated form', () => {
    expect(getFlagValue(['--mode', 'staging'], '--mode')).toBe('staging')
  })

  it('getFlagValue reads equals form', () => {
    expect(getFlagValue(['--mode=staging'], '--mode')).toBe('staging')
  })

  it('getFlagValue reads --config with equals form', () => {
    expect(getFlagValue(['--config=my.config.ts'], '--config')).toBe('my.config.ts')
  })

  it('getFlagValue returns undefined when flag absent', () => {
    expect(getFlagValue(['build'], '--mode')).toBeUndefined()
  })

  it('getFlagValue returns undefined when flag value starts with -', () => {
    expect(getFlagValue(['--mode', '--other'], '--mode')).toBeUndefined()
  })
})
