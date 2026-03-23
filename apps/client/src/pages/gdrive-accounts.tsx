import React, { useState, useEffect, useCallback } from 'react';
import { gdriveManager, type GoogleDriveAccount } from '@/lib/gdrive-plugin';
import { TauriAPI } from '@/lib/tauri-api';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import {
  Cloud,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface GoogleDriveAccountsPageProps {
  className?: string;
  mode?: 'page' | 'embed';
}

const GoogleDriveAccountsPage = (props: GoogleDriveAccountsPageProps) => {
  const { className, mode = 'page' } = props;
  const [accounts, setAccounts] = useState<GoogleDriveAccount[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Credentials state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(true);

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isEmbed = mode === 'embed';

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await TauriAPI.getGdriveSettings();
        if (settings.client_id) {
          setClientId(settings.client_id);
          setClientSecret(settings.client_secret);
          setCredentialsConfigured(true);
          setShowSetup(false);
        }
      } catch {
        // Not configured yet
      }
    };
    loadSettings();
  }, []);

  // Load accounts on mount
  const loadAccounts = useCallback(async () => {
    try {
      const allAccounts = await gdriveManager.getAccounts();
      setAccounts(allAccounts);
    } catch (err) {
      console.error('Failed to load Google Drive accounts:', err);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Listen for account changes
  useEffect(() => {
    const handleAccountsChanged = () => {
      loadAccounts();
    };

    window.addEventListener('gdrive-accounts-changed', handleAccountsChanged);
    return () => window.removeEventListener('gdrive-accounts-changed', handleAccountsChanged);
  }, [loadAccounts]);

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: 'Missing Fields',
        description: 'Both Client ID and Client Secret are required.',
        variant: 'destructive',
      });
      return;
    }

    setCredentialsSaving(true);
    try {
      await TauriAPI.updateGdriveSettings(clientId.trim(), clientSecret.trim());
      setCredentialsConfigured(true);
      toast({
        title: 'Credentials Saved',
        description: 'Google Drive API credentials have been saved.',
      });
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: `Failed to save credentials: ${err instanceof Error ? err.message : String(err)}`,
        variant: 'destructive',
      });
    } finally {
      setCredentialsSaving(false);
    }
  };

  const handleAddAccount = async () => {
    if (!credentialsConfigured) {
      toast({
        title: 'Credentials Required',
        description: 'Please configure your Google API credentials first.',
        variant: 'destructive',
      });
      setShowSetup(true);
      return;
    }

    setIsAuthenticating(true);

    try {
      await gdriveManager.authenticate();
      await loadAccounts();

      toast({
        title: 'Account Connected',
        description: 'Google Drive account has been connected successfully.',
      });
    } catch (err) {
      toast({
        title: 'Authentication Failed',
        description: `Failed to connect Google account: ${err instanceof Error ? err.message : String(err)}`,
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const openAccountInExplorer = (account: GoogleDriveAccount) => {
    try {
      sessionStorage.setItem(
        STORAGE_KEYS.PENDING_GDRIVE_TAB,
        JSON.stringify({ accountId: account.id, accountName: account.email }),
      );
    } catch (err) {
      console.warn('Failed to schedule Google Drive tab opening:', err);
    }

    if (isEmbed) {
      window.dispatchEvent(
        new CustomEvent('open-gdrive-tab', {
          detail: { accountId: account.id, accountName: account.email },
        }),
      );
    } else {
      setLocation('/');
    }
  };

  const handleDisconnect = async (account: GoogleDriveAccount) => {
    try {
      await gdriveManager.disconnect(account.id);
      await loadAccounts();

      toast({
        title: 'Disconnected',
        description: `Disconnected from ${account.email}.`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to disconnect: ${err instanceof Error ? err.message : String(err)}`,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveAccount = async (account: GoogleDriveAccount) => {
    if (!confirm(`Are you sure you want to remove the account "${account.email}"?`)) return;

    try {
      await gdriveManager.removeAccount(account.id);
      await loadAccounts();

      toast({
        title: 'Account Removed',
        description: `${account.email} has been removed.`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: `Failed to remove account: ${err instanceof Error ? err.message : String(err)}`,
        variant: 'destructive',
      });
    }
  };

  let accountsSection: React.ReactNode;
  if (!credentialsConfigured) {
    accountsSection = (
      <div className="flex min-h-[300px] flex-1 items-center justify-center">
        <div className="text-xp-text-muted max-w-md py-8 text-center">
          <div className="bg-xp-surface-light mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Cloud className="h-8 w-8" />
          </div>
          <h3 className="text-xp-text mb-2 text-lg font-medium">Configure API credentials first</h3>
          <p className="text-xp-text-muted">
            Set up your Google Cloud OAuth credentials above to start connecting Google Drive
            accounts.
          </p>
        </div>
      </div>
    );
  } else if (accounts.length === 0) {
    accountsSection = (
      <div className="flex min-h-[300px] flex-1 items-center justify-center">
        <div className="text-xp-text-muted max-w-md py-8 text-center">
          <div className="bg-xp-surface-light mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Cloud className="h-8 w-8" />
          </div>
          <h3 className="text-xp-text mb-2 text-lg font-medium">Connect your Google Drive</h3>
          <p className="text-xp-text-muted mb-4">
            Sign in with your Google account to browse and manage your Drive files directly from
            Xplorer.
          </p>

          <button
            onClick={handleAddAccount}
            disabled={isAuthenticating}
            className="bg-xp-blue hover:bg-xp-blue-dark focus:ring-xp-blue rounded-md px-6 py-2 text-white transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Sign in with Google"
          >
            {isAuthenticating ? (
              <span className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Connecting...</span>
              </span>
            ) : (
              'Sign in with Google'
            )}
          </button>
        </div>
      </div>
    );
  } else {
    accountsSection = (
      <div className="p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-xp-surface border-xp-border rounded-lg border p-4 transition-all hover:shadow-md"
            >
              {/* Account Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex min-w-0 items-center space-x-2">
                  <Cloud className="text-xp-blue h-5 w-5 flex-shrink-0" />
                  <h3 className="text-xp-text truncate font-medium">{account.email}</h3>
                </div>

                <div className="flex flex-shrink-0 items-center space-x-1">
                  <button
                    onClick={() => handleRemoveAccount(account)}
                    className="text-xp-text-muted hover:text-xp-red focus:ring-xp-blue p-1 transition-colors focus:outline-none focus:ring-1"
                    title="Remove Account"
                    aria-label={`Remove account ${account.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Account Details */}
              <div className="text-xp-text-muted mb-4 space-y-2 text-sm">
                {account.displayName && (
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="truncate">{account.displayName}</span>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <span className="truncate">{account.email}</span>
                </div>

                {account.lastSynced && (
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs">
                      Last synced: {new Date(account.lastSynced).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={() => openAccountInExplorer(account)}
                  className="bg-xp-blue hover:bg-xp-blue-dark focus:ring-xp-blue flex flex-1 items-center justify-center space-x-2 rounded px-3 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-1"
                  aria-label={`Open Google Drive for ${account.email}`}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open</span>
                </button>

                <button
                  onClick={() => handleDisconnect(account)}
                  className="bg-xp-red hover:bg-xp-red/80 focus:ring-xp-blue rounded px-3 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-1"
                  aria-label={`Disconnect ${account.email}`}
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-xp-bg flex h-full flex-col ${className || ''}`}>
      {/* Header */}
      <div className="border-xp-border bg-xp-surface flex items-center justify-between border-b p-6">
        <div className="flex items-center space-x-3">
          {!isEmbed && (
            <button
              onClick={() => setLocation('/explorer')}
              className="hover:bg-xp-surface-light focus:ring-xp-blue rounded-md p-2 transition-colors focus:outline-none focus:ring-1"
              title="Back to Explorer"
              aria-label="Back to Explorer"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xp-text text-xl font-semibold">Google Drive</h1>
            <p className="text-xp-text-muted text-sm">
              Configure API credentials and manage connected accounts
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddAccount}
            disabled={isAuthenticating || !credentialsConfigured}
            className="bg-xp-blue hover:bg-xp-blue-dark focus:ring-xp-blue flex items-center space-x-2 rounded-md px-4 py-2 text-white transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Add Google account"
          >
            {isAuthenticating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Add Google Account</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* API Credentials Section */}
        <div className="border-xp-border border-b p-6">
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="focus:ring-xp-blue mb-2 flex w-full items-center space-x-2 text-left focus:outline-none focus:ring-1"
            aria-label="Toggle API credentials section"
          >
            {showSetup ? (
              <ChevronDown className="text-xp-text-muted h-4 w-4" />
            ) : (
              <ChevronRight className="text-xp-text-muted h-4 w-4" />
            )}
            <h2 className="text-xp-text text-sm font-semibold">API Credentials</h2>
            {credentialsConfigured ? (
              <span className="text-xp-green flex items-center space-x-1 text-xs">
                <CheckCircle className="h-3 w-3" />
                <span>Configured</span>
              </span>
            ) : (
              <span className="text-xp-yellow flex items-center space-x-1 text-xs">
                <AlertCircle className="h-3 w-3" />
                <span>Not configured</span>
              </span>
            )}
          </button>

          {showSetup && (
            <div className="mt-4 space-y-4">
              {/* Setup Guide */}
              <div className="bg-xp-surface border-xp-border rounded-lg border p-4">
                <h3 className="text-xp-text mb-3 text-sm font-medium">Setup Guide</h3>
                <ol className="text-xp-text-muted list-inside list-decimal space-y-2 text-sm">
                  <li>
                    Go to the{' '}
                    <a
                      href="https://console.cloud.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xp-blue hover:underline"
                    >
                      Google Cloud Console
                    </a>
                  </li>
                  <li>Create a new project or select an existing one</li>
                  <li>
                    Navigate to <strong className="text-xp-text">APIs & Services</strong> and enable
                    the <strong className="text-xp-text">Google Drive API</strong>
                  </li>
                  <li>
                    Go to <strong className="text-xp-text">Credentials</strong> &rarr;{' '}
                    <strong className="text-xp-text">Create Credentials</strong> &rarr;{' '}
                    <strong className="text-xp-text">OAuth 2.0 Client ID</strong>
                  </li>
                  <li>
                    Set application type to <strong className="text-xp-text">Desktop app</strong>
                  </li>
                  <li>
                    Copy the <strong className="text-xp-text">Client ID</strong> and{' '}
                    <strong className="text-xp-text">Client Secret</strong>, then paste them below
                  </li>
                </ol>
              </div>

              {/* Credential Inputs */}
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="gdrive-client-id"
                    className="text-xp-text mb-1 block text-sm font-medium"
                  >
                    Client ID
                  </label>
                  <input
                    id="gdrive-client-id"
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                    className="bg-xp-bg border-xp-border text-xp-text placeholder-xp-text-muted focus:ring-xp-blue focus:border-xp-blue w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="gdrive-client-secret"
                    className="text-xp-text mb-1 block text-sm font-medium"
                  >
                    Client Secret
                  </label>
                  <div className="relative">
                    <input
                      id="gdrive-client-secret"
                      type={showSecret ? 'text' : 'password'}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="GOCSPX-..."
                      className="bg-xp-bg border-xp-border text-xp-text placeholder-xp-text-muted focus:ring-xp-blue focus:border-xp-blue w-full rounded-md border px-3 py-2 pr-20 text-sm focus:outline-none focus:ring-1"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light focus:ring-xp-blue absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-1"
                      aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showSecret ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSaveCredentials}
                  disabled={credentialsSaving || !clientId.trim() || !clientSecret.trim()}
                  className="bg-xp-blue hover:bg-xp-blue-dark focus:ring-xp-blue rounded-md px-4 py-2 text-sm text-white transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Save API credentials"
                >
                  {credentialsSaving ? 'Saving...' : 'Save Credentials'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Accounts Section */}
        {accountsSection}
      </div>
    </div>
  );
};

export default GoogleDriveAccountsPage;
