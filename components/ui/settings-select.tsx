'use client';

import { Select } from '@base-ui/react/select';
import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface SettingsSelectProps {
  id: string;
  options: { value: string; label: string }[];
  value: string;
  disabled?: boolean;
  renderOptionIcon?: (value: string) => ReactNode;
  'aria-label'?: string;
  'aria-describedby'?: string;
  onValueChange: (value: string) => void;
}

export function SettingsSelect({
  id,
  options,
  value,
  disabled,
  renderOptionIcon,
  onValueChange,
  'aria-describedby': description,
  'aria-label': label,
}: SettingsSelectProps) {
  return (
    <Select.Root
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <Select.Trigger
        id={id}
        aria-label={label}
        aria-describedby={description}
        className="cq-settings-select"
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="cq-select-layer"
          align="start"
          alignItemWithTrigger={false}
          sideOffset={4}
          collisionPadding={8}
        >
          <Select.Popup
            className="cq-select-menu"
            data-illustrated={renderOptionIcon ? true : undefined}
          >
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="cq-select-option"
                >
                  {renderOptionIcon && (
                    <span className="cq-option-portrait" aria-hidden="true">
                      {renderOptionIcon(option.value)}
                    </span>
                  )}
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={16} strokeWidth={3} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
