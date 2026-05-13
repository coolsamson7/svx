module.exports = {
  displayName: 'api',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/api',
  moduleNameMapper: {
    '^@svx/auth-nestjs$': '<rootDir>/src/__mocks__/@svx/auth-nestjs.ts',
  },
};
