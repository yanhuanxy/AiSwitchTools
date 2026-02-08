import vue from "eslint-plugin-vue"
import vueParser from "vue-eslint-parser"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"

export default [
  {
    files: ["src/**/*.{ts,vue}"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        parser: tsParser
      }
    },
    plugins: {
      vue,
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "vue/multi-word-component-names": "off"
    }
  }
]
