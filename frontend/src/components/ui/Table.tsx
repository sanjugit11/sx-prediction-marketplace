import React from 'react';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className = '', ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-lg border border-white/5 bg-slate-950/20">
      <table ref={ref} className={`w-full text-sm text-left text-slate-300 border-collapse ${className}`} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = ({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={`text-xs text-slate-400 uppercase bg-white/5 border-b border-white/10 ${className}`} {...props} />
);

export const TableBody = ({ className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={`divide-y divide-white/5 ${className}`} {...props} />
);

export const TableRow = ({ className = '', ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={`hover:bg-white/5 transition-colors duration-150 ${className}`} {...props} />
);

export const TableHead = ({ className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={`px-5 py-3.5 font-semibold text-slate-300 tracking-wider ${className}`} {...props} />
);

export const TableCell = ({ className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`px-5 py-3.5 align-middle ${className}`} {...props} />
);
