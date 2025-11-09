pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DnaTree_FHE is ZamaEthereumConfig {
    
    struct GeneticRecord {
        string dnaSequenceHash;        
        euint32 encryptedMarkers;      
        uint256 publicMetadata;        
        string description;            
        address owner;                 
        uint256 timestamp;             
        uint32 decryptedSimilarity;    
        bool isAnalyzed;               
    }
    
    mapping(string => GeneticRecord) public geneticRecords;
    string[] public recordIds;
    
    event GeneticRecordCreated(string indexed recordId, address indexed owner);
    event AncestryAnalysisComplete(string indexed recordId, uint32 similarityScore);
    
    constructor() ZamaEthereumConfig() {
    }
    
    function createGeneticRecord(
        string calldata recordId,
        string calldata dnaSequenceHash,
        externalEuint32 encryptedMarkers,
        bytes calldata inputProof,
        uint256 publicMetadata,
        string calldata description
    ) external {
        require(bytes(geneticRecords[recordId].dnaSequenceHash).length == 0, "Genetic record already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedMarkers, inputProof)), "Invalid encrypted markers");
        
        geneticRecords[recordId] = GeneticRecord({
            dnaSequenceHash: dnaSequenceHash,
            encryptedMarkers: FHE.fromExternal(encryptedMarkers, inputProof),
            publicMetadata: publicMetadata,
            description: description,
            owner: msg.sender,
            timestamp: block.timestamp,
            decryptedSimilarity: 0,
            isAnalyzed: false
        });
        
        FHE.allowThis(geneticRecords[recordId].encryptedMarkers);
        FHE.makePubliclyDecryptable(geneticRecords[recordId].encryptedMarkers);
        
        recordIds.push(recordId);
        emit GeneticRecordCreated(recordId, msg.sender);
    }
    
    function analyzeAncestry(
        string calldata recordId, 
        bytes memory abiEncodedSimilarity,
        bytes memory analysisProof
    ) external {
        require(bytes(geneticRecords[recordId].dnaSequenceHash).length > 0, "Genetic record does not exist");
        require(!geneticRecords[recordId].isAnalyzed, "Analysis already completed");
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(geneticRecords[recordId].encryptedMarkers);
        
        FHE.checkSignatures(cts, abiEncodedSimilarity, analysisProof);
        
        uint32 decodedSimilarity = abi.decode(abiEncodedSimilarity, (uint32));
        
        geneticRecords[recordId].decryptedSimilarity = decodedSimilarity;
        geneticRecords[recordId].isAnalyzed = true;
        
        emit AncestryAnalysisComplete(recordId, decodedSimilarity);
    }
    
    function getEncryptedMarkers(string calldata recordId) external view returns (euint32) {
        require(bytes(geneticRecords[recordId].dnaSequenceHash).length > 0, "Genetic record does not exist");
        return geneticRecords[recordId].encryptedMarkers;
    }
    
    function getGeneticRecord(string calldata recordId) external view returns (
        string memory dnaSequenceHash,
        uint256 publicMetadata,
        string memory description,
        address owner,
        uint256 timestamp,
        bool isAnalyzed,
        uint32 decryptedSimilarity
    ) {
        require(bytes(geneticRecords[recordId].dnaSequenceHash).length > 0, "Genetic record does not exist");
        GeneticRecord storage record = geneticRecords[recordId];
        
        return (
            record.dnaSequenceHash,
            record.publicMetadata,
            record.description,
            record.owner,
            record.timestamp,
            record.isAnalyzed,
            record.decryptedSimilarity
        );
    }
    
    function getAllRecordIds() external view returns (string[] memory) {
        return recordIds;
    }
    
    function isAvailable() public pure returns (bool) {
        return true;
    }
}

