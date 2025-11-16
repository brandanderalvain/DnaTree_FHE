# DnaTree_FHE: Private DNA Ancestry Analysis

DnaTree_FHE is a groundbreaking application designed to protect your genetic privacy while analyzing your ancestry. Leveraging Zama's Fully Homomorphic Encryption (FHE) technology, DnaTree_FHE allows users to upload encrypted DNA data, perform similarity matching against a database, and query ancestry information without ever exposing sensitive genetic information. 

## The Problem

In today's digital age, privacy is more crucial than ever, especially when it comes to personal health data like DNA sequences. Many existing ancestry analysis tools require users to submit their genetic information in cleartext, raising significant privacy and security concerns. The potential misuse of this data can lead to identity theft, discrimination, and unwanted exposure of sensitive information. By not adopting proper privacy measures, users risk compromising their genetic privacy, which can have long-lasting negative implications.

## The Zama FHE Solution

DnaTree_FHE addresses these pressing concerns using Fully Homomorphic Encryption. This innovative encryption technology allows computations to be performed directly on encrypted data, providing results without ever decrypting the information. By utilizing Zama's libraries, such as the fhevm, DnaTree_FHE ensures that DNA data remains confidential throughout the entire analysis process.

Using the advances provided by Zama's FHE technology, we can securely perform operations like similarity comparisons on encrypted DNA sequences. This means that users can receive accurate ancestry insights without relinquishing control over their genetic data.

## Key Features

- 🔒 **Privacy-Preserving Analysis**: DNA sequences are encrypted and never exposed in cleartext during analysis.
- 🌳 **Ancestry Insights**: Obtain ancestry information without compromising your genetic data.
- 🔄 **Similarity Matching**: Compare encrypted DNA sequences against a secure database to find potential relatives.
- 📈 **User-Friendly Interface**: Intuitive design that makes it easy for anyone to understand their ancestry analysis.
- 👨‍👩‍👧‍👦 **Family Tree Visualization**: Generate and visualize potential family connections based on encrypted data.

## Technical Architecture & Stack

DnaTree_FHE is built on a robust architecture that prioritizes security and efficiency. The core technology stack includes:

- **Frontend**: React.js
- **Backend**: Node.js
- **Database**: Encrypted database system for secure data storage
- **Core Privacy Engine**: Zama's FHE technology (using fhevm for encrypted computations)

## Smart Contract / Core Logic

The backend of DnaTree_FHE utilizes Zama's FHE libraries to ensure that all DNA analyses are performed on encrypted data. Below is a simplified pseudo-code example demonstrating how we handle encrypted DNA input:solidity
pragma solidity ^0.8.0;

import "ZamaLibrary.sol"; // Hypothetical import for Zama's library

contract DnaTree {
    // Store encrypted DNA data
    mapping(address => EncryptedDna) public userEncryptedData;

    function uploadDna(EncryptedDna memory dna) public {
        userEncryptedData[msg.sender] = dna;
    }

    function analyzeDna(address user) public view returns (AncestryResult) {
        EncryptedDna memory dna = userEncryptedData[user];
        EncryptedDna memory result = FHE.matchSimilarity(dna, database);
        return result;
    }
}

## Directory Structure

The project follows a structured approach to ensure clarity and ease of access:
DnaTree_FHE/
├── src/
│   ├── components/
│   ├── services/
│   └── App.js
├── contracts/
│   └── DnaTree.sol
├── scripts/
│   └── main.py
├── tests/
│   └── test_DnaTree.py
├── package.json
└── README.md

## Installation & Setup

### Prerequisites

To get started with DnaTree_FHE, ensure you have the following installed:

- Node.js
- npm (Node Package Manager)
- Python
- pip (Python Package Installer)

### Installation Steps

1. **Clone the repository** (ensure you have access to the repository).
2. **Install JavaScript dependencies**:bash
   npm install
   npm install fhevm

3. **Install Python dependencies**:bash
   pip install concrete-ml

## Build & Run

Once you have completed the setup, you can build and run the project:

1. **Compile the smart contract**:bash
   npx hardhat compile

2. **Run the backend server**:bash
   npm start

3. **Execute the main Python script** to analyze DNA:bash
   python scripts/main.py

## Acknowledgements

We would like to extend our deepest gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their commitment to advancing privacy technology is what allows DnaTree_FHE to offer a secure and trustworthy solution for DNA ancestry analysis.

---
DnaTree_FHE is poised to revolutionize how individuals interact with their genetic data, paving the way for a future where privacy and accessibility coexist harmoniously. Join us in protecting genetic privacy, one DNA sequence at a time.

