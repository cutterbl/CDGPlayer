export default {
  extends: ['@commitlint/config-conventional'],
  formatter: './commitlint.formatter.mjs',
  rules: {
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
