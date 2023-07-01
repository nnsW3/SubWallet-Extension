// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { CloseIcon, CustomModal, Layout, PageWrapper } from '@subwallet/extension-koni-ui/components';
import AccountAvatar from '@subwallet/extension-koni-ui/components/Account/AccountAvatar';
import InstructionContainer, { InstructionContentType } from '@subwallet/extension-koni-ui/components/InstructionContainer';
import { ScreenContext } from '@subwallet/extension-koni-ui/contexts/ScreenContext';
import useDeleteAccount from '@subwallet/extension-koni-ui/hooks/account/useDeleteAccount';
import useGetAccountByAddress from '@subwallet/extension-koni-ui/hooks/account/useGetAccountByAddress';
import useGetAccountSignModeByAddress from '@subwallet/extension-koni-ui/hooks/account/useGetAccountSignModeByAddress';
import useNotification from '@subwallet/extension-koni-ui/hooks/common/useNotification';
import useDefaultNavigate from '@subwallet/extension-koni-ui/hooks/router/useDefaultNavigate';
import { deriveAccountV3, editAccount, forgetAccount } from '@subwallet/extension-koni-ui/messaging';
import { PhosphorIcon, Theme, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { AccountSignMode } from '@subwallet/extension-koni-ui/types/account';
import { FormCallbacks, FormFieldData } from '@subwallet/extension-koni-ui/types/form';
import { toShort } from '@subwallet/extension-koni-ui/utils';
import { copyToClipboard } from '@subwallet/extension-koni-ui/utils/common/dom';
import { convertFieldToObject } from '@subwallet/extension-koni-ui/utils/form/form';
import { BackgroundIcon, Button, Field, Form, Icon, Input, ModalContext, QRCode } from '@subwallet/react-ui';
import CN from 'classnames';
import { CircleNotch, CopySimple, Export, Eye, FloppyDiskBack, QrCode, ShareNetwork, Swatches, TrashSimple, User } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import styled, { useTheme } from 'styled-components';

// import NftImport from '../Home/Nfts/NftImport';
import AccountExport from './AccountExport';

type Props = ThemeProps;

enum FormFieldName {
  NAME = 'name'
}

enum ActionType {
  EXPORT = 'export',
  DERIVE = 'derive',
  DELETE = 'delete'
}

interface DetailFormState {
  [FormFieldName.NAME]: string;
}

const EXPORT_ACCOUNT_MODAL = 'export_account_modal';

const instructionContents: InstructionContentType[] = [
  {
    title: 'Why do I need to enter a password?',
    description: 'For your wallet protection, SubWallet locks your wallet after 15 minutes of inactivity. You will need this password to unlock it.',
    type: 'warning'
  },
  {
    title: 'Can I recover a password?',
    description: 'The password is stored securely on your device. We will not be able to recover it for you, so make sure you remember it!',
    type: 'warning'
  }
];

const Component: React.FC<Props> = (props: Props) => {
  const { className } = props;

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { goHome } = useDefaultNavigate();
  const notify = useNotification();
  const { token } = useTheme() as Theme;
  const { accountAddress } = useParams();
  const { activeModal, inactiveModal } = useContext(ModalContext);

  const [form] = Form.useForm<DetailFormState>();

  const account = useGetAccountByAddress(accountAddress);
  const deleteAccountAction = useDeleteAccount();

  const { isWebUI } = useContext(ScreenContext);

  const saveTimeOutRef = useRef<NodeJS.Timer>();

  const [deleting, setDeleting] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [saving, setSaving] = useState(false);

  const signMode = useGetAccountSignModeByAddress(accountAddress);

  const canDerive = useMemo((): boolean => {
    if (account) {
      if (account.isExternal) {
        return false;
      } else {
        if (account.type === 'ethereum') {
          return !!account.isMasterAccount;
        } else {
          return true;
        }
      }
    } else {
      return false;
    }
  }, [account]);

  const walletNamePrefixIcon = useMemo((): PhosphorIcon => {
    switch (signMode) {
      case AccountSignMode.LEDGER:
        return Swatches;
      case AccountSignMode.QR:
        return QrCode;
      case AccountSignMode.READ_ONLY:
        return Eye;
      default:
        return User;
    }
  }, [signMode]);

  const onDelete = useCallback(() => {
    if (account?.address) {
      deleteAccountAction()
        .then(() => {
          setDeleting(true);
          forgetAccount(account.address)
            .then(() => {
              goHome();
            })
            .catch((e: Error) => {
              notify({
                message: e.message,
                type: 'error'
              });
            })
            .finally(() => {
              setDeleting(false);
            });
        })
        .catch((e: Error) => {
          if (e) {
            notify({
              message: e.message,
              type: 'error'
            });
          }
        });
    }
  }, [account?.address, deleteAccountAction, notify, goHome]);

  const onDerive = useCallback(() => {
    if (!account?.address) {
      return;
    }

    setDeriving(true);

    setTimeout(() => {
      deriveAccountV3({
        address: account.address
      }).then(() => {
        goHome();
      }).catch((e: Error) => {
        notify({
          message: e.message,
          type: 'error'
        });
      }).finally(() => {
        setDeriving(false);
      });
    }, 500);
  }, [account?.address, goHome, notify]);

  const onExport = useCallback(() => {
    if (account?.address) {
      if (isWebUI) {
        activeModal(EXPORT_ACCOUNT_MODAL);
      } else {
        navigate(`/accounts/export/${account.address}`);
      }
    }
  }, [account?.address, isWebUI, activeModal, navigate]);

  const onCopyAddress = useCallback(() => {
    copyToClipboard(account?.address || '');
    notify({
      message: 'Copied'
    });
  }, [account?.address, notify]);

  const onUpdate: FormCallbacks<DetailFormState>['onFieldsChange'] = useCallback((changedFields: FormFieldData[], _allFields: FormFieldData[]) => {
    const changeMap = convertFieldToObject<DetailFormState>(changedFields);

    if (changeMap[FormFieldName.NAME]) {
      clearTimeout(saveTimeOutRef.current);
      setSaving(true);
      saveTimeOutRef.current = setTimeout(() => {
        form.submit();
      }, 1000);
    }
  }, [form]);

  const onSubmit: FormCallbacks<DetailFormState>['onFinish'] = useCallback((values: DetailFormState) => {
    clearTimeout(saveTimeOutRef.current);
    const name = values[FormFieldName.NAME];

    if (!account || name === account.name) {
      setSaving(false);

      return;
    }

    const address = account.address;

    if (!address) {
      setSaving(false);

      return;
    }

    editAccount(account.address, name.trim())
      .catch(console.error)
      .finally(() => {
        setSaving(false);
      });
  }, [account]);

  useEffect(() => {
    if (!account) {
      goHome();
    }
  }, [account, goHome, navigate]);

  const closeExportModal = useCallback(() => {
    inactiveModal(EXPORT_ACCOUNT_MODAL);
  }, [inactiveModal]);

  if (!account) {
    return null;
  }

  return (
    <PageWrapper className={CN(className)}>
      <Layout.Base
        disableBack={deriving}
        headerList={['Simple']}
        showWebHeader={isWebUI}
        {...!isWebUI && {
          showBackButton: true,
          showSubHeader: true,
          subHeaderBackground: 'transparent',
          subHeaderCenter: true,
          subHeaderPaddingVertical: true,
          showHeader: false
        }}
        subHeaderIcons={[
          {
            icon: <CloseIcon />,
            onClick: goHome,
            disabled: deriving
          }
        ]}
        title={t('Account details')}
      >
        <div className={CN('body-container', {
          '__web-ui': isWebUI
        })}
        >
          <div className='main-content'>
            {!isWebUI && (
              <div className='account-qr'>
                <QRCode
                  errorLevel='M'
                  icon=''
                  iconSize={token.sizeLG * 1.5}
                  size={token.sizeXL * 3.5}
                  value={account.address}
                />
              </div>
            )}
            <Form
              form={form}
              initialValues={{
                [FormFieldName.NAME]: account.name || ''
              }}
              name='account-detail-form'
              onFieldsChange={onUpdate}
              onFinish={onSubmit}
            >
              <Form.Item
                className={CN('account-field')}
                name={FormFieldName.NAME}
                rules={[
                  {
                    message: 'Wallet name is required',
                    transform: (value: string) => value.trim(),
                    required: true
                  }
                ]}
                statusHelpAsTooltip={true}
              >
                <Input
                  className='account-name-input'
                  disabled={deriving}
                  label={t('Wallet name')}
                  onBlur={form.submit}
                  placeholder={t('Wallet name')}
                  prefix={(
                    <BackgroundIcon
                      backgroundColor='var(--wallet-name-icon-bg-color)'
                      iconColor='var(--wallet-name-icon-color)'
                      phosphorIcon={walletNamePrefixIcon}
                    />
                  )}
                  suffix={(
                    <Icon
                      className={CN({ loading: saving })}
                      phosphorIcon={saving ? CircleNotch : FloppyDiskBack}
                      size='sm'
                    />
                  )}
                />
              </Form.Item>
            </Form>
            <div className={CN('account-field', 'mb-lg')}>
              <Field
                content={toShort(account.address, 11, 13)}
                label={t('Wallet address')}
                placeholder={t('Wallet address')}
                prefix={(
                  <AccountAvatar
                    size={token.sizeMD}
                    value={account.address}
                  />
                )}
                suffix={(
                  <Button
                    icon={(
                      <Icon
                        phosphorIcon={CopySimple}
                        size='sm'
                      />
                    )}
                    onClick={onCopyAddress}
                    size='xs'
                    type='ghost'
                  />
                )}
              />
            </div>
            <Button
              block={true}
              className={CN('account-button', `action-type-${ActionType.DERIVE}`)}
              contentAlign='left'
              disabled={!canDerive}
              icon={(
                <BackgroundIcon
                  backgroundColor='var(--icon-bg-color)'
                  phosphorIcon={ShareNetwork}
                  size='sm'
                  weight='fill'
                />
              )}
              loading={deriving}
              onClick={onDerive}
              schema='secondary'
            >
              {t('Derive account')}
            </Button>
            <Button
              block={true}
              className={CN('account-button', `action-type-${ActionType.EXPORT}`)}
              contentAlign='left'
              disabled={account.isExternal || deriving}
              icon={(
                <BackgroundIcon
                  backgroundColor='var(--icon-bg-color)'
                  phosphorIcon={Export}
                  size='sm'
                  weight='fill'
                />
              )}
              onClick={onExport}
              schema='secondary'
            >
              {t('Export account')}
            </Button>
            <Button
              block={true}
              className={CN('account-button', `action-type-${ActionType.DELETE}`)}
              contentAlign='left'
              disabled={deriving}
              icon={(
                <BackgroundIcon
                  backgroundColor='var(--icon-bg-color)'
                  phosphorIcon={TrashSimple}
                  size='sm'
                  weight='fill'
                />
              )}
              loading={deleting}
              onClick={onDelete}
              schema='secondary'
            >
              {t('Remove account')}
            </Button>
          </div>

          {isWebUI &&
            <InstructionContainer contents={instructionContents} />
          }
        </div>

        {isWebUI && (
          <CustomModal
            id={EXPORT_ACCOUNT_MODAL}
            onCancel={closeExportModal}
            title={t('Export account')}
          >
            <AccountExport
              accountAddress={account?.address}
              modalContent
            />
          </CustomModal>
        )}
      </Layout.Base>
    </PageWrapper>
  );
};

const AccountDetail = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    '.body-container': {
      '&.__web-ui': {
        display: 'flex',
        justifyContent: 'center',
        gap: 16,
        width: '60%',
        margin: '0 auto',

        '.anticon': {
          height: 'unset !important',
          width: 'unset !important'
        },

        '& > *': {
          flex: 1
        },

        '.form-container': {
          '.ant-btn': {
            width: '100%'
          }
        }
      },

      padding: `0 ${token.padding}px`,
      '--wallet-name-icon-bg-color': token['geekblue-6'],
      '--wallet-name-icon-color': token.colorWhite,

      '.ant-background-icon': {
        width: token.sizeMD,
        height: token.sizeMD,

        '.anticon': {
          height: token.sizeSM,
          width: token.sizeSM
        }
      },

      '.account-qr': {
        marginTop: token.margin,
        marginBottom: token.marginLG,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center'
      },

      '.account-field': {
        marginBottom: token.marginXS,

        '.single-icon-only': {
          color: token['gray-4']
        },

        '.ant-input-label': {
          marginBottom: token.marginXS - 2
        },

        '.ant-input-suffix': {
          marginRight: 0,
          marginLeft: token.marginXS
        },

        '.ant-btn': {
          height: 'auto',
          marginRight: -(token.marginSM - 2)
        }
      },

      '.mb-lg': {
        marginBottom: token.marginLG
      },

      '.account-button': {
        marginBottom: token.marginXS,
        gap: token.sizeXS,
        color: token.colorTextLight1,

        '&:disabled': {
          color: token.colorTextLight1,
          opacity: 0.4
        }
      },

      [`.action-type-${ActionType.DERIVE}`]: {
        '--icon-bg-color': token['magenta-7']
      },

      [`.action-type-${ActionType.EXPORT}`]: {
        '--icon-bg-color': token['green-6']
      },

      [`.action-type-${ActionType.DELETE}`]: {
        '--icon-bg-color': token['colorError-6'],
        color: token['colorError-6'],

        '.ant-background-icon': {
          color: token.colorTextLight1
        },

        '&:disabled': {
          color: token['colorError-6'],

          '.ant-background-icon': {
            color: token.colorTextLight1
          }
        }
      }
    },

    '.account-name-input': {
      '.loading': {
        color: token['gray-5'],
        animation: 'spinner-loading 1s infinite linear'
      }
    }
  };
});

export default AccountDetail;
