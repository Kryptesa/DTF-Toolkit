import globals from "globals";
import pluginJs from "@eslint/js";
import stylisticJs from '@stylistic/eslint-plugin-js';

export default [
  {
    plugins: {
      '@stylistic/js': stylisticJs,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@stylistic/js/indent': [
        'error',
        2,
        {
          "SwitchCase": 1,
        }],
      '@stylistic/js/comma-dangle': [
        'warn', 
        'always-multiline',
      ],
      '@stylistic/js/semi': [
        'warn',
        'always',
      ],
    },
  },
  pluginJs.configs.recommended,
];