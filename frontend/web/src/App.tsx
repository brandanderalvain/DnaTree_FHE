import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { JSX, useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface DNARecord {
  id: number;
  name: string;
  ethnicity: string;
  similarity: string;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
  encryptedValueHandle?: string;
}

interface AncestryAnalysis {
  similarityScore: number;
  ethnicDiversity: number;
  geneticMarkers: number;
  privacyLevel: number;
  confidence: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [dnaRecords, setDnaRecords] = useState<DNARecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingDNA, setUploadingDNA] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newDNAData, setNewDNAData] = useState({ name: "", ethnicity: "", similarity: "" });
  const [selectedRecord, setSelectedRecord] = useState<DNARecord | null>(null);
  const [decryptedData, setDecryptedData] = useState<{ similarity: number | null; ethnicity: number | null }>({ similarity: null, ethnicity: null });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const recordsList: DNARecord[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          recordsList.push({
            id: parseInt(businessId.replace('dna-', '')) || Date.now(),
            name: businessData.name,
            ethnicity: businessId,
            similarity: businessId,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setDnaRecords(recordsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const uploadDNA = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setUploadingDNA(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting DNA data with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const similarityValue = parseInt(newDNAData.similarity) || 0;
      const businessId = `dna-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, similarityValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newDNAData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newDNAData.ethnicity) || 0,
        0,
        "DNA Ancestry Analysis"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Uploading encrypted DNA..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "DNA data uploaded successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowUploadModal(false);
      setNewDNAData({ name: "", ethnicity: "", similarity: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Upload failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setUploadingDNA(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "DNA similarity already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying DNA similarity..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "DNA data decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "DNA data is already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const analyzeDNA = (record: DNARecord, decryptedSimilarity: number | null, decryptedEthnicity: number | null): AncestryAnalysis => {
    const similarity = record.isVerified ? (record.decryptedValue || 0) : (decryptedSimilarity || record.publicValue1 || 50);
    const ethnicity = record.publicValue1 || 5;
    
    const baseSimilarity = Math.min(100, Math.round((similarity * 0.8 + ethnicity * 0.2) * 1.2));
    const timeFactor = Math.max(0.7, Math.min(1.3, 1 - (Date.now()/1000 - record.timestamp) / (60 * 60 * 24 * 30)));
    const similarityScore = Math.round(baseSimilarity * timeFactor);
    
    const ethnicDiversity = Math.round(ethnicity * 8 + Math.log(similarity + 1) * 2);
    const geneticMarkers = Math.round(similarity * 0.6 + ethnicity * 0.4);
    
    const privacyLevel = Math.max(85, Math.min(99, 100 - (similarity * 0.05 + ethnicity * 0.1)));
    const confidence = Math.min(95, Math.round((similarity * 0.7 + ethnicity * 0.3) * 0.95));

    return {
      similarityScore,
      ethnicDiversity,
      geneticMarkers,
      privacyLevel,
      confidence
    };
  };

  const renderStats = () => {
    const totalAnalyses = dnaRecords.length;
    const verifiedAnalyses = dnaRecords.filter(m => m.isVerified).length;
    const avgEthnicity = dnaRecords.length > 0 
      ? dnaRecords.reduce((sum, m) => sum + m.publicValue1, 0) / dnaRecords.length 
      : 0;
    
    const recentAnalyses = dnaRecords.filter(m => 
      Date.now()/1000 - m.timestamp < 60 * 60 * 24 * 7
    ).length;

    return (
      <div className="stats-grid">
        <div className="stat-card neon-purple">
          <h3>Total Analyses</h3>
          <div className="stat-value">{totalAnalyses}</div>
          <div className="stat-trend">+{recentAnalyses} this week</div>
        </div>
        
        <div className="stat-card neon-blue">
          <h3>Verified Data</h3>
          <div className="stat-value">{verifiedAnalyses}/{totalAnalyses}</div>
          <div className="stat-trend">FHE Verified</div>
        </div>
        
        <div className="stat-card neon-pink">
          <h3>Avg Ethnicity Score</h3>
          <div className="stat-value">{avgEthnicity.toFixed(1)}/10</div>
          <div className="stat-trend">Encrypted</div>
        </div>
        
        <div className="stat-card neon-green">
          <h3>Privacy Level</h3>
          <div className="stat-value">99.9%</div>
          <div className="stat-trend">FHE Protected</div>
        </div>
      </div>
    );
  };

  const renderDNAChart = (record: DNARecord, decryptedSimilarity: number | null, decryptedEthnicity: number | null) => {
    const analysis = analyzeDNA(record, decryptedSimilarity, decryptedEthnicity);
    
    return (
      <div className="dna-chart">
        <div className="chart-row">
          <div className="chart-label">Similarity Score</div>
          <div className="chart-bar">
            <div 
              className="bar-fill neon-purple" 
              style={{ width: `${analysis.similarityScore}%` }}
            >
              <span className="bar-value">{analysis.similarityScore}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Ethnic Diversity</div>
          <div className="chart-bar">
            <div 
              className="bar-fill neon-blue" 
              style={{ width: `${Math.min(100, analysis.ethnicDiversity)}%` }}
            >
              <span className="bar-value">{analysis.ethnicDiversity}</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Genetic Markers</div>
          <div className="chart-bar">
            <div 
              className="bar-fill neon-pink" 
              style={{ width: `${analysis.geneticMarkers}%` }}
            >
              <span className="bar-value">{analysis.geneticMarkers}</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Privacy Level</div>
          <div className="chart-bar">
            <div 
              className="bar-fill neon-green" 
              style={{ width: `${analysis.privacyLevel}%` }}
            >
              <span className="bar-value">{analysis.privacyLevel}%</span>
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-label">Confidence</div>
          <div className="chart-bar">
            <div 
              className="bar-fill neon-cyan" 
              style={{ width: `${analysis.confidence}%` }}
            >
              <span className="bar-value">{analysis.confidence}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFHEFlow = () => {
    return (
      <div className="fhe-flow">
        <div className="flow-step">
          <div className="step-icon">🧬</div>
          <div className="step-content">
            <h4>DNA Encryption</h4>
            <p>Genetic data encrypted with Zama FHE 🔐</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">🌐</div>
          <div className="step-content">
            <h4>Secure Upload</h4>
            <p>Encrypted data stored on blockchain</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">🔍</div>
          <div className="step-content">
            <h4>Homomorphic Analysis</h4>
            <p>Compare with database without decryption</p>
          </div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="step-icon">🌳</div>
          <div className="step-content">
            <h4>Get Ancestry</h4>
            <p>Receive results without exposing DNA</p>
          </div>
        </div>
      </div>
    );
  };

  const filteredRecords = dnaRecords.filter(record =>
    record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.creator.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>DNA Tree FHE 🌳🔐</h1>
            <p>Private DNA Ancestry Analysis</p>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🧬</div>
            <h2>Connect Your Wallet to Begin</h2>
            <p>Secure your genetic privacy with fully homomorphic encryption technology</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Upload encrypted DNA data for analysis</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Get ancestry results without exposing genes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="dna-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your genetic data</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="dna-spinner"></div>
      <p>Loading DNA analysis system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>DNA Tree FHE 🌳🔐</h1>
          <p>Private Ancestry Analysis</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowUploadModal(true)} 
            className="upload-btn neon-glow"
          >
            🧬 Upload DNA
          </button>
          <button 
            onClick={() => setShowFAQ(!showFAQ)} 
            className="faq-btn"
          >
            ❓ FAQ
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="dashboard-section">
          <h2>Private DNA Ancestry Analysis</h2>
          {renderStats()}
          
          <div className="fhe-panel">
            <h3>FHE 🔐 Genetic Privacy Flow</h3>
            {renderFHEFlow()}
          </div>
        </div>
        
        <div className="analyses-section">
          <div className="section-header">
            <h2>DNA Analysis Records</h2>
            <div className="header-actions">
              <input 
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button 
                onClick={loadData} 
                className="refresh-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "🔄" : "🔁"}
              </button>
            </div>
          </div>
          
          <div className="records-grid">
            {filteredRecords.length === 0 ? (
              <div className="no-records">
                <p>No DNA analyses found</p>
                <button 
                  className="upload-btn" 
                  onClick={() => setShowUploadModal(true)}
                >
                  Upload First Analysis
                </button>
              </div>
            ) : filteredRecords.map((record, index) => (
              <div 
                className={`record-card ${selectedRecord?.id === record.id ? "selected" : ""} ${record.isVerified ? "verified" : ""}`} 
                key={index}
                onClick={() => setSelectedRecord(record)}
              >
                <div className="card-header">
                  <div className="record-name">{record.name}</div>
                  <div className="record-status">
                    {record.isVerified ? "✅ Verified" : "🔓 Ready"}
                  </div>
                </div>
                <div className="card-content">
                  <div className="record-meta">
                    <span>Ethnicity Score: {record.publicValue1}/10</span>
                    <span>{new Date(record.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="record-creator">
                    By: {record.creator.substring(0, 6)}...{record.creator.substring(38)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {showUploadModal && (
        <ModalUploadDNA 
          onSubmit={uploadDNA} 
          onClose={() => setShowUploadModal(false)} 
          uploading={uploadingDNA} 
          dnaData={newDNAData} 
          setDnaData={setNewDNAData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedRecord && (
        <DNADetailModal 
          record={selectedRecord} 
          onClose={() => { 
            setSelectedRecord(null); 
            setDecryptedData({ similarity: null, ethnicity: null }); 
          }} 
          decryptedData={decryptedData} 
          setDecryptedData={setDecryptedData} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedRecord.ethnicity)}
          renderDNAChart={renderDNAChart}
        />
      )}
      
      {showFAQ && (
        <FAQModal onClose={() => setShowFAQ(false)} />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === "pending" && <div className="dna-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalUploadDNA: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  uploading: boolean;
  dnaData: any;
  setDnaData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, uploading, dnaData, setDnaData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'similarity') {
      const intValue = value.replace(/[^\d]/g, '');
      setDnaData({ ...dnaData, [name]: intValue });
    } else {
      setDnaData({ ...dnaData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="upload-dna-modal">
        <div className="modal-header">
          <h2>Upload DNA Data</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Genetic Privacy</strong>
            <p>Your DNA similarity will be encrypted with Zama FHE (Integer only)</p>
          </div>
          
          <div className="form-group">
            <label>Analysis Name *</label>
            <input 
              type="text" 
              name="name" 
              value={dnaData.name} 
              onChange={handleChange} 
              placeholder="Enter analysis name..." 
            />
          </div>
          
          <div className="form-group">
            <label>DNA Similarity Score (Integer) *</label>
            <input 
              type="number" 
              name="similarity" 
              value={dnaData.similarity} 
              onChange={handleChange} 
              placeholder="Enter similarity score..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Ethnicity Diversity (1-10) *</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              name="ethnicity" 
              value={dnaData.ethnicity} 
              onChange={handleChange} 
              placeholder="Enter ethnicity score..." 
            />
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={uploading || isEncrypting || !dnaData.name || !dnaData.similarity || !dnaData.ethnicity} 
            className="submit-btn neon-glow"
          >
            {uploading || isEncrypting ? "🔐 Encrypting DNA..." : "🧬 Upload DNA"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DNADetailModal: React.FC<{
  record: DNARecord;
  onClose: () => void;
  decryptedData: { similarity: number | null; ethnicity: number | null };
  setDecryptedData: (value: { similarity: number | null; ethnicity: number | null }) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
  renderDNAChart: (record: DNARecord, decryptedSimilarity: number | null, decryptedEthnicity: number | null) => JSX.Element;
}> = ({ record, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData, renderDNAChart }) => {
  const handleDecrypt = async () => {
    if (decryptedData.similarity !== null) { 
      setDecryptedData({ similarity: null, ethnicity: null }); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData({ similarity: decrypted, ethnicity: decrypted });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="dna-detail-modal">
        <div className="modal-header">
          <h2>DNA Analysis Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="dna-info">
            <div className="info-item">
              <span>Analysis Name:</span>
              <strong>{record.name}</strong>
            </div>
            <div className="info-item">
              <span>Researcher:</span>
              <strong>{record.creator.substring(0, 6)}...{record.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Analysis Date:</span>
              <strong>{new Date(record.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>Ethnic Diversity:</span>
              <strong>{record.publicValue1}/10</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted DNA Similarity</h3>
            
            <div className="data-row">
              <div className="data-label">Similarity Score:</div>
              <div className="data-value">
                {record.isVerified && record.decryptedValue ? 
                  `${record.decryptedValue}% (Verified)` : 
                  decryptedData.similarity !== null ? 
                  `${decryptedData.similarity}% (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn ${(record.isVerified || decryptedData.similarity !== null) ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "🔓 Decrypting..."
                ) : record.isVerified ? (
                  "✅ Verified"
                ) : decryptedData.similarity !== null ? (
                  "🔄 Re-decrypt"
                ) : (
                  "🔓 Decrypt Similarity"
                )}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE 🔐 Genetic Privacy</strong>
                <p>Your DNA similarity is encrypted on-chain. Decrypt to see ancestry matches.</p>
              </div>
            </div>
          </div>
          
          {(record.isVerified || decryptedData.similarity !== null) && (
            <div className="analysis-section">
              <h3>Ancestry Analysis Results</h3>
              {renderDNAChart(
                record, 
                record.isVerified ? record.decryptedValue || null : decryptedData.similarity, 
                null
              )}
              
              <div className="decrypted-values">
                <div className="value-item">
                  <span>DNA Similarity:</span>
                  <strong>
                    {record.isVerified ? 
                      `${record.decryptedValue}%` : 
                      `${decryptedData.similarity}%`
                    }
                  </strong>
                  <span className={`data-badge ${record.isVerified ? 'verified' : 'local'}`}>
                    {record.isVerified ? 'On-chain Verified' : 'Local Decryption'}
                  </span>
                </div>
                <div className="value-item">
                  <span>Ethnic Diversity:</span>
                  <strong>{record.publicValue1}/10</strong>
                  <span className="data-badge public">Public Data</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!record.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn neon-glow"
            >
              {isDecrypting ? "Verifying..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const FAQModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const faqs = [
    {
      question: "What is FHE in DNA testing?",
      answer: "Fully Homomorphic Encryption allows analyzing your DNA without decrypting it, preserving genetic privacy."
    },
    {
      question: "How is my data protected?",
      answer: "Your DNA data remains encrypted throughout the entire ancestry analysis process using Zama FHE technology."
    },
    {
      question: "What can the system analyze?",
      answer: "The system compares encrypted DNA markers with our database to identify ancestry matches and ethnic origins."
    },
    {
      question: "Is my genetic data stored securely?",
      answer: "Yes, all genetic information is encrypted and only similarity scores are computed homomorphically."
    }
  ];

  return (
    <div className="modal-overlay">
      <div className="faq-modal">
        <div className="modal-header">
          <h2>FHE DNA Analysis FAQ</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <h4>{faq.question}</h4>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;

