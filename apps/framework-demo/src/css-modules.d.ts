/**
 * TypeScript module declaration for imported CSS Module class maps.
 */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
