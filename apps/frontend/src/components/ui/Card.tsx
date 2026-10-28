/**
 * Card Component
 * 
 * A container component for grouping related content.
 * 
 * Current: Simple API with props
 * Future: Can export sub-components (CardHeader, CardBody, etc.) for complex cases
 * 
 * Usage:
 *   <Card title="My Courses" subtitle="3 enrolled">
 *     <CourseList />
 *   </Card>
 * 
 *   <Card 
 *     title={<div className="flex gap-2"><Icon /> Title</div>}
 *     footer={<Button>Action</Button>}
 *   >
 *     Content
 *   </Card>
 */

import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import styles from './Card.module.css';

// =============================================================================
// Types
// =============================================================================

// Omit 'title' from HTMLAttributes since we redefine it as ReactNode
export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Card title - can be string or ReactNode for custom layouts */
  title?: ReactNode;
  /** Heading level of the title (default h3); pick it so the page outline has no gaps */
  titleAs?: 'h2' | 'h3' | 'h4';
  /** Subtitle displayed below title */
  subtitle?: ReactNode;
  /** Footer content - typically actions */
  footer?: ReactNode;
  /** Padding size for the body */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Add hover effect (for clickable cards) */
  hoverable?: boolean;
  /** Card content */
  children?: ReactNode;
}

// =============================================================================
// Internal Sub-components (private for now, exportable in future)
// =============================================================================

interface CardRootProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  children: ReactNode;
}

const CardRoot = forwardRef<HTMLDivElement, CardRootProps>(
  ({ hoverable, className, children, ...props }, ref) => {
    const classNames = [
      styles.card,
      hoverable && styles.hoverable,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={classNames} {...props}>
        {children}
      </div>
    );
  }
);

interface CardHeaderProps {
  children: ReactNode;
}

function CardHeader({ children }: CardHeaderProps) {
  return <div className={styles.header}>{children}</div>;
}

interface CardTitleProps {
  as?: 'h2' | 'h3' | 'h4';
  children: ReactNode;
}

function CardTitle({ as: Heading = 'h3', children }: CardTitleProps) {
  return <Heading className={styles.title}>{children}</Heading>;
}

interface CardSubtitleProps {
  children: ReactNode;
}

function CardSubtitle({ children }: CardSubtitleProps) {
  return <p className={styles.subtitle}>{children}</p>;
}

interface CardBodyProps {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

function CardBody({ padding = 'md', children }: CardBodyProps) {
  const classNames = [styles.body, styles[`padding-${padding}`]]
    .filter(Boolean)
    .join(' ');

  return <div className={classNames}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
}

function CardFooter({ children }: CardFooterProps) {
  return <div className={styles.footer}>{children}</div>;
}

// =============================================================================
// Main Component (Simple API)
// =============================================================================

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      title,
      titleAs,
      subtitle,
      footer,
      padding = 'md',
      hoverable = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <CardRoot ref={ref} hoverable={hoverable} className={className} {...props}>
        {(title || subtitle) && (
          <CardHeader>
            {title && <CardTitle as={titleAs}>{title}</CardTitle>}
            {subtitle && <CardSubtitle>{subtitle}</CardSubtitle>}
          </CardHeader>
        )}
        <CardBody padding={padding}>{children}</CardBody>
        {footer && <CardFooter>{footer}</CardFooter>}
      </CardRoot>
    );
  }
);

Card.displayName = 'Card';

// =============================================================================
// Future: Export sub-components for compound API
// Uncomment when needed:
// 
// export { CardRoot, CardHeader, CardTitle, CardSubtitle, CardBody, CardFooter };
// =============================================================================
