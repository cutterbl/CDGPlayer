import styles from './SourceLinkRow.module.css';

/**
 * Props for a small source-navigation row shown above the demo.
 */
/**
 * SourceLinkRow input props.
 */
export type SourceLinkRowProps = {
  href: string;
  label: string;
};

/**
 * Renders a compact "View Source" link row for quick code navigation.
 */
function SourceLinkRow({ href, label }: SourceLinkRowProps) {
  return (
    // Small utility row so developers can jump from running demo to source quickly.
    <div className={styles.sourceLinkRow}>
      <span className={styles.sourceLinkLabel}>View Source:</span>
      <a
        className={styles.sourceLink}
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    </div>
  );
}

export default SourceLinkRow;
