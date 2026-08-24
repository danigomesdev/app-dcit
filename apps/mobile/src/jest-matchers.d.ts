// expo-router/testing-library registers these custom Jest matchers at runtime
// (see expo-router/build/testing-library/expect.js) but ships no type
// declarations for them. Declare them here so `tsc --noEmit` type-checks
// tests that use `expect(screen).toHavePathname(...)` and friends.
declare namespace jest {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type -- must match the type parameter list of the base `Matchers<R, T = {}>` interface being augmented
  interface Matchers<R, T = {}> {
    toHavePathname(pathname: string): R;
    toHavePathnameWithParams(pathname: string): R;
    toHaveSegments(segments: string[]): R;
    toHaveSearchParams(params: Record<string, string | string[]>): R;
    toHaveRouterState(state: unknown): R;
  }
}
