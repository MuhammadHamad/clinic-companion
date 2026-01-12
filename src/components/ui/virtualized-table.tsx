import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

export interface VirtualizedTableColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  className?: string;
  render: (item: T, index: number) => React.ReactNode;
}

export interface VirtualizedTableProps<T> {
  data: T[];
  columns: VirtualizedTableColumn<T>[];
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  emptyMessage?: React.ReactNode;
  getRowKey: (item: T, index: number) => string;
}

export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 48,
  maxHeight = 400,
  className,
  headerClassName,
  rowClassName,
  emptyMessage = 'No data available',
  getRowKey,
}: VirtualizedTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (data.length === 0) {
    return (
      <div className={cn('border rounded-md', className)}>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      {/* Header */}
      <div
        className={cn(
          'flex border-b bg-muted/50 font-medium text-sm',
          headerClassName
        )}
        style={{ height: rowHeight }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn(
              'flex items-center px-3 py-2',
              col.className
            )}
            style={{ width: col.width, flexShrink: col.width ? 0 : 1, flexGrow: col.width ? 0 : 1 }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ maxHeight: maxHeight - rowHeight }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index];
            const rowKey = getRowKey(item, virtualRow.index);
            const rowClasses =
              typeof rowClassName === 'function'
                ? rowClassName(item, virtualRow.index)
                : rowClassName;

            return (
              <div
                key={rowKey}
                className={cn(
                  'flex border-b last:border-b-0 hover:bg-muted/30 transition-colors',
                  rowClasses
                )}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      'flex items-center px-3 py-2 text-sm',
                      col.className
                    )}
                    style={{ width: col.width, flexShrink: col.width ? 0 : 1, flexGrow: col.width ? 0 : 1 }}
                  >
                    {col.render(item, virtualRow.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedTable;
