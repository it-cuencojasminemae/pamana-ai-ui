import { createRevealDirective } from '../services/uiMotion'

export default defineNuxtPlugin(app => {
  app.vueApp.directive('pamana-reveal', createRevealDirective())
})
