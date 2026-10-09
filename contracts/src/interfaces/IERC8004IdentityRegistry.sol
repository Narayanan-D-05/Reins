// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IERC8004IdentityRegistry
/// @notice Minimal interface for the deployed ERC-8004 Identity Registry.
///         Identity only — Reins never calls the reputation/feedback
///         extension of ERC-8004 (see PRD §6.1).
/// @dev Matches IdentityRegistryUpgradeable at
///      0x8004A818BFB912233c491871b3d84c89A494BD9e on Monad Testnet
///      (chain id 10143). Verified against the erc-8004/erc-8004-contracts
///      source — do not change these signatures without re-checking against
///      the deployed bytecode.
interface IERC8004IdentityRegistry {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    function register() external returns (uint256 agentId);
    function register(string memory agentURI) external returns (uint256 agentId);
    function register(string memory agentURI, MetadataEntry[] memory metadata) external returns (uint256 agentId);

    function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory);
    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external;

    function setAgentURI(uint256 agentId, string calldata newURI) external;

    function getAgentWallet(uint256 agentId) external view returns (address);
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external;
    function unsetAgentWallet(uint256 agentId) external;

    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool);

    // Inherited from ERC721
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}
