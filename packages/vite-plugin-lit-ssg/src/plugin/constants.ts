export const PLUGIN_NAME = 'vite-plugin-lit-ssg'

export const VIRTUAL_SHARED_ID = 'virtual:lit-ssg-shared'
export const VIRTUAL_SERVER_ID = 'virtual:lit-ssg-server'
export const RESOLVED_VIRTUAL_SHARED_ID = '\0' + VIRTUAL_SHARED_ID
export const RESOLVED_VIRTUAL_SERVER_ID = '\0' + VIRTUAL_SERVER_ID
export const VIRTUAL_PAGE_PREFIX = 'virtual:lit-ssg-page/'
export const RESOLVED_VIRTUAL_PAGE_PREFIX = '\0' + VIRTUAL_PAGE_PREFIX
export const VIRTUAL_DEV_PAGE_PREFIX = 'virtual:lit-ssg-dev-page/'
export const RESOLVED_VIRTUAL_DEV_PAGE_PREFIX = '\0' + VIRTUAL_DEV_PAGE_PREFIX

export const VIRTUAL_SINGLE_CLIENT_ID = 'virtual:lit-ssg-single-client'
export const RESOLVED_VIRTUAL_SINGLE_CLIENT_ID = '\0' + VIRTUAL_SINGLE_CLIENT_ID
export const VIRTUAL_SINGLE_ISLAND_RUNTIME_ID = 'virtual:lit-ssg-single-island-runtime'
export const RESOLVED_VIRTUAL_SINGLE_ISLAND_RUNTIME_ID = '\0' + VIRTUAL_SINGLE_ISLAND_RUNTIME_ID
export const VIRTUAL_SINGLE_SERVER_ID = 'virtual:lit-ssg-single-server'
export const RESOLVED_VIRTUAL_SINGLE_SERVER_ID = '\0' + VIRTUAL_SINGLE_SERVER_ID
export const VIRTUAL_SINGLE_DEV_ID = 'virtual:lit-ssg-single-dev'
export const RESOLVED_VIRTUAL_SINGLE_DEV_ID = '\0' + VIRTUAL_SINGLE_DEV_ID

const ACTIVE_BUILD_KEY = '__vitePluginLitSsgActiveBuilds'

type GlobalWithActiveBuilds = typeof globalThis & {
  [ACTIVE_BUILD_KEY]?: Set<string>
}

const globalWithActiveBuilds = globalThis as GlobalWithActiveBuilds

export const _ssgActive = globalWithActiveBuilds[ACTIVE_BUILD_KEY] ??= new Set<string>()
