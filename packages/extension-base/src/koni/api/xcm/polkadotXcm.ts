// Copyright 2019-2022 @subwallet/extension-base
// SPDX-License-Identifier: Apache-2.0

import { _ChainAsset, _ChainInfo } from '@subwallet/chain-list/types';
import { getBeneficiary, getDestWeight } from '@subwallet/extension-base/koni/api/xcm/utils';
import { _getSubstrateParaId, _getXcmAssetMultilocation, _isSubstrateParaChain, _isSubstrateRelayChain } from '@subwallet/extension-base/services/chain-service/utils';

import { ApiPromise } from '@polkadot/api';

function getDestinationChainLocation (destinationChainInfo: _ChainInfo) {
  if (_isSubstrateParaChain(destinationChainInfo)) {
    return {
      V1: {
        parents: 1,
        interior: {
          X1: { Parachain: _getSubstrateParaId(destinationChainInfo) }
        }
      }
    };
  }

  return { // to relaychain by default
    V1: {
      parents: 1,
      interior: 'Here'
    }
  };
}

function getAssetLocation (tokenInfo: _ChainAsset, sendingValue: string) {
  const multilocation = _getXcmAssetMultilocation(tokenInfo);

  return {
    V1: [
      {
        id: multilocation,
        fun: { Fungible: sendingValue }
      }
    ]
  };
}

export function getExtrinsicByPolkadotXcmPallet (tokenInfo: _ChainAsset, originChainInfo: _ChainInfo, destinationChainInfo: _ChainInfo, recipientAddress: string, value: string, api: ApiPromise) {
  const weightParam = getDestWeight(api);
  const beneficiary = getBeneficiary(originChainInfo, destinationChainInfo, recipientAddress);
  const destination = getDestinationChainLocation(destinationChainInfo);
  const assetLocation = getAssetLocation(tokenInfo, value);

  let method = 'limitedReserveTransferAssets';

  if (['astar', 'shiden'].includes(originChainInfo.slug)) {
    method = 'limitedReserveWithdrawAssets';
  } else if (_isSubstrateRelayChain(destinationChainInfo)) {
    method = 'limitedTeleportAssets';
  }

  return api.tx.polkadotXcm[method](
    destination,
    beneficiary,
    assetLocation,
    0, // FeeAssetItem
    weightParam
  );
}
