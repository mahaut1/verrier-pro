/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'server',
      rootDir: '<rootDir>/server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testRegex: ['(/__tests__/.*|\\.(test|spec))\\.ts$'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: '<rootDir>/tsconfig.jest.json',
          diagnostics: false,
        }],
      },
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/../shared/$1',
        '^\\.\\./storage/index\\.js$': '<rootDir>/storage/index.ts',
        '^\\.\\./storage/(.*)\\.js$': '<rootDir>/storage/$1.ts',
        '^\\.\\./\\.\\./shared/(.*)\\.js$': '<rootDir>/../shared/$1.ts',
        '^\\.\\./lib/r2\\.js$': '<rootDir>/lib/r2.ts',
      },
      setupFiles: ['<rootDir>/test/setup-env.js'],
      clearMocks: true,
      coverageDirectory: '<rootDir>/coverage',
       coverageThreshold: {
        global: {
          branches: 50,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },

    // CLIENT (React + jsdom via babel-jest) 
    {
      displayName: 'client',
      rootDir: '<rootDir>/client',
      testEnvironment: 'jsdom',

      // Babel AVEC presets (JSX + TSX pris en charge)
      transform: {
        '^.+\\.(t|j)sx?$': ['babel-jest', {
          presets: [
            ['@babel/preset-env', { targets: { node: 'current' } }],
            ['@babel/preset-react', { runtime: 'automatic' }],
            '@babel/preset-typescript',
          ],
        }],
      },

      testRegex: ['(/__tests__/.*|\\.(test|spec))\\.tsx$'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@shared/(.*)$': '<rootDir>/../shared/$1',
        '^@/components/ui/(.*)$': '<rootDir>/test/__mocks__/ui/$1',
        '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
        '\\.(gif|ttf|eot|svg|png|jpg|jpeg)$': '<rootDir>/test/__mocks__/fileMock.js',
      },

      //  on pointe sur le .js CommonJS
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
      clearMocks: true,
      coverageDirectory: '<rootDir>/coverage',
       coverageThreshold: {
        global: {
          branches: 50,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
  ],
};
