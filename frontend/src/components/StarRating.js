'use client';

export default function StarRating({
  value = 0,
  max = 5,
  size = 18,
  onSelect,
  label = 'Rating',
  className = '',
}) {
  const rounded = Math.round(Number(value) || 0);
  const isInteractive = typeof onSelect === 'function';

  return (
    <div
      className={`rating-stars ${className}`.trim()}
      role={isInteractive ? 'radiogroup' : undefined}
      aria-label={label}
    >
      {Array.from({ length: max }).map((_, index) => {
        const filled = index < rounded;
        const starClass = isInteractive ? 'rating-star-button' : 'rating-star';
        const classNames = `${starClass}${filled ? ' filled' : ''}`;
        const star = <StarIcon size={size} />;

        if (isInteractive) {
          return (
            <button
              key={`star-${index}`}
              type="button"
              className={classNames}
              onClick={() => onSelect(index + 1)}
              aria-label={`${index + 1} star${index === 0 ? '' : 's'}`}
            >
              {star}
            </button>
          );
        }

        return (
          <span key={`star-${index}`} className={classNames} aria-hidden="true">
            {star}
          </span>
        );
      })}
    </div>
  );
}

function StarIcon({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.75l2.75 5.58 6.16.9-4.46 4.35 1.05 6.13L12 16.9 6.5 19.71l1.05-6.13L3.09 9.23l6.16-.9L12 2.75z" />
    </svg>
  );
}
