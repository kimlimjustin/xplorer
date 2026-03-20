import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { PasswordPromptDialog } from '@/components/dialogs/PasswordPromptDialog';

// Mock props
const mockProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  title: 'Authentication Required',
  description: 'Please enter your password to continue.',
};

const mockSSHProps = {
  ...mockProps,
  connectionName: 'Test Server',
  username: 'testuser',
  host: 'example.com',
  showRememberOption: true,
};

describe('PasswordPromptDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders dialog when open', () => {
    render(<PasswordPromptDialog {...mockProps} />);

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password to continue.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<PasswordPromptDialog {...mockProps} isOpen={false} />);

    expect(screen.queryByText('Authentication Required')).not.toBeInTheDocument();
  });

  test('displays SSH connection details when provided', () => {
    render(<PasswordPromptDialog {...mockSSHProps} title="" description="" />);

    expect(screen.getByText('SSH Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Connection:')).toBeInTheDocument();
    expect(screen.getByText('Test Server')).toBeInTheDocument();
    expect(screen.getByText('Server:')).toBeInTheDocument();
    expect(screen.getByText('testuser@example.com')).toBeInTheDocument();
  });

  test('handles password input', async () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
    });

    expect(passwordInput.value).toBe('mypassword');
  });

  test('toggles password visibility', async () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /show|hide password/i });

    // Initially password should be hidden
    expect(passwordInput.type).toBe('password');

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(passwordInput.type).toBe('text');

    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(passwordInput.type).toBe('password');
  });

  test('handles remember option when shown', async () => {
    render(<PasswordPromptDialog {...mockProps} showRememberOption={true} />);

    const rememberCheckbox = screen.getByLabelText(/remember password/i) as HTMLInputElement;

    expect(rememberCheckbox).toBeInTheDocument();
    expect(rememberCheckbox.checked).toBe(false);

    await act(async () => {
      fireEvent.click(rememberCheckbox);
    });

    expect(rememberCheckbox.checked).toBe(true);
  });

  test('does not show remember option by default', () => {
    render(<PasswordPromptDialog {...mockProps} />);

    expect(screen.queryByLabelText(/remember password/i)).not.toBeInTheDocument();
  });

  test('submits form with password and remember state', async () => {
    render(<PasswordPromptDialog {...mockProps} showRememberOption={true} />);

    const passwordInput = screen.getByLabelText('Password');
    const rememberCheckbox = screen.getByLabelText(/remember password/i);
    const submitButton = screen.getByRole('button', { name: /continue/i });

    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'testpassword' } });
      fireEvent.click(rememberCheckbox);
      fireEvent.click(submitButton);
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith('testpassword', true);
  });

  test('submits form on enter key', async () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const passwordInput = screen.getByLabelText('Password');

    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'testpassword' } });
      fireEvent.keyDown(passwordInput, { key: 'Enter', code: 'Enter' });
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith('testpassword', false);
  });

  test('does not submit with empty password', async () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const submitButton = screen.getByRole('button', { name: /continue/i });

    expect(submitButton).toBeDisabled();

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockProps.onSubmit).not.toHaveBeenCalled();
  });

  test('does not submit with whitespace-only password', async () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: /continue/i });

    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: '   ' } });
    });

    expect(submitButton).toBeDisabled();

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockProps.onSubmit).not.toHaveBeenCalled();
  });

  test('calls onClose when cancel button clicked', async () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  test('calls onClose when X button clicked', async () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const closeButton = screen.getByRole('button', { name: /close/i });

    await act(async () => {
      fireEvent.click(closeButton);
    });

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  test('resets form when dialog opens', async () => {
    const { rerender } = render(<PasswordPromptDialog {...mockProps} isOpen={false} />);

    // Open dialog and enter password
    rerender(<PasswordPromptDialog {...mockProps} isOpen={true} />);

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    const rememberCheckbox = screen.queryByLabelText(/remember password/i) as HTMLInputElement;

    if (rememberCheckbox) {
      await act(async () => {
        fireEvent.change(passwordInput, { target: { value: 'testpass' } });
        fireEvent.click(rememberCheckbox);
      });
    }

    // Close and reopen dialog
    rerender(<PasswordPromptDialog {...mockProps} isOpen={false} showRememberOption={true} />);
    rerender(<PasswordPromptDialog {...mockProps} isOpen={true} showRememberOption={true} />);

    // Form should be reset
    expect(screen.getByLabelText('Password')).toHaveValue('');
    if (screen.queryByLabelText(/remember password/i)) {
      expect(screen.getByLabelText(/remember password/i)).not.toBeChecked();
    }
  });

  test('shows loading state', async () => {
    render(<PasswordPromptDialog {...mockProps} isLoading={true} />);

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: /authenticating/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  test('prevents closing while loading', async () => {
    render(<PasswordPromptDialog {...mockProps} isLoading={true} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const closeButton = screen.getByRole('button', { name: /close/i });

    await act(async () => {
      fireEvent.click(cancelButton);
      fireEvent.click(closeButton);
    });

    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  test('shows security notice', () => {
    render(<PasswordPromptDialog {...mockProps} />);

    expect(screen.getByText('Security Notice')).toBeInTheDocument();
    expect(screen.getByText(/Passwords are stored securely in memory/)).toBeInTheDocument();
  });

  test('auto-focuses password input', () => {
    render(<PasswordPromptDialog {...mockProps} />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveFocus();
  });

  test('handles form submission correctly', async () => {
    render(<PasswordPromptDialog {...mockProps} showRememberOption={true} />);

    const form = screen.getByRole('form') || screen.getByLabelText('Password').closest('form');
    const passwordInput = screen.getByLabelText('Password');
    const rememberCheckbox = screen.getByLabelText(/remember password/i);

    await act(async () => {
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
      fireEvent.click(rememberCheckbox);
    });

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith('mypassword', true);
  });

  test('uses fallback title and description for SSH connections', () => {
    render(
      <PasswordPromptDialog
        {...mockProps}
        title=""
        description=""
        connectionName="My Server"
        username="user"
        host="server.com"
      />,
    );

    expect(screen.getByText('SSH Authentication Required')).toBeInTheDocument();
    expect(
      screen.getByText(/Please enter your password to connect to user@server.com/),
    ).toBeInTheDocument();
  });

  test('handles missing SSH connection details gracefully', () => {
    render(
      <PasswordPromptDialog
        {...mockProps}
        title=""
        description=""
        connectionName={undefined}
        username={undefined}
        host={undefined}
      />,
    );

    expect(screen.getByText('SSH Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password to continue.')).toBeInTheDocument();
  });
});
