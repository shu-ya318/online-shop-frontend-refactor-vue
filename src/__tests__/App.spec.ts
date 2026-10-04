import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'

import App from '../App.vue'
import i18n from '../plugins/i18n'

describe('App', () => {
  it('mounts renders properly', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createVuetify(), i18n],
      },
    })
    expect(wrapper.text()).toContain('Look Go')
  })
})
