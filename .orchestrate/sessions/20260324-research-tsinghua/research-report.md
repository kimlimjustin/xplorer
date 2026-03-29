# Tsinghua University Professors & Papers Related to Xplorer

## Executive Summary

We identified **30+ Tsinghua professors** across 6 departments whose research areas overlap with Xplorer's technical domains. The strongest overlaps are in: **(1) AI agents & tool use** (THUNLP, KEG Lab), **(2) sandboxing & systems security** (NISL, WingTecher, MadSys), **(3) file systems & storage** (Storage Lab), **(4) information retrieval & search** (THUIR), and **(5) HCI & desktop interaction** (PCG Lab).

---

## 1. AI Agents, LLM Tool Use & Intelligent Systems

*Overlaps with: Xplorer's Claude-powered agent layer, Ollama integration, AI-powered search, auto-tagging*

### Prof. Zhiyuan Liu (刘知远) — THUNLP, Dept. of CS&T
- **Research**: LLMs, tool learning, multi-agent systems
- **Key papers**:
  - **ToolLLM** (ICLR 2024 Spotlight) — Training LLMs to master 16,000+ APIs. [arXiv](https://arxiv.org/abs/2307.16789) | [GitHub](https://github.com/OpenBMB/ToolBench)
  - **ChatDev** (ACL 2024) — Multi-agent communicative software development. [arXiv](https://arxiv.org/abs/2307.07924) | [GitHub](https://github.com/OpenBMB/ChatDev)
  - **AgentVerse** (ICLR 2024) — Multi-agent collaboration framework. [arXiv](https://arxiv.org/abs/2308.10848)
  - **BMTools** — Open-source tool-learning platform. [GitHub](https://github.com/OpenBMB/BMTools)
- **Homepage**: [nlp.csai.tsinghua.edu.cn/~lzy/](https://nlp.csai.tsinghua.edu.cn/~lzy/)

### Prof. Jie Tang (唐杰) — KEG Lab, Dept. of CS&T
- **Research**: LLMs (ChatGLM/GLM), data mining, AI agents
- **Key papers**:
  - **AgentBench** (ICLR 2024) — Benchmark evaluating LLMs as agents across 8 environments. [arXiv](https://arxiv.org/abs/2308.03688)
  - **AgentTuning** (ACL Findings 2024) — Enabling generalized agent abilities. [ACL](https://aclanthology.org/2024.findings-acl.181/)
  - **CogAgent** (CVPR 2024) — Visual language model for GUI agents. [arXiv](https://arxiv.org/abs/2312.08914)
  - **AutoWebGLM** (KDD 2024) — Web-navigating agent. [ACM DL](https://dl.acm.org/doi/10.1145/3637528.3671620)
- **Homepage**: [keg.cs.tsinghua.edu.cn/jietang/](https://keg.cs.tsinghua.edu.cn/jietang/)

### Prof. Maosong Sun (孙茂松) — THUNLP, Dept. of CS&T
- **Research**: NLP, web intelligence, computational pedagogy. ACL Fellow (2022).
- **Key papers**: Senior/corresponding author on ChatDev, oversees THUNLP's agent research line.
- **Homepage**: [cs.tsinghua.edu.cn/csen/info/1312/4394.htm](https://www.cs.tsinghua.edu.cn/csen/info/1312/4394.htm)

### Prof. Guoliang Li (李国良) — Database Group, Dept. of CS&T
- **Research**: AI for data management, NL2SQL, data agents
- **Key papers**:
  - **Data Agent** (ICDE 2025 Keynote) — Orchestrating Data+AI ecosystems from natural language. [PDF](https://dbgroup.cs.tsinghua.edu.cn/ligl/papers/ICDE2025-Data-Agent-keynote.pdf)
  - **D-Bot** (VLDB 2024) — LLM-powered autonomous database diagnosis. [arXiv](https://arxiv.org/abs/2312.01454) | [GitHub](https://github.com/TsinghuaDatabaseGroup/DB-GPT)
  - **LLM x DATA Survey** (2025). [PDF](https://dbgroup.cs.tsinghua.edu.cn/ligl/papers/DataAI-2025.pdf)
- **Homepage**: [dbgroup.cs.tsinghua.edu.cn/ligl/](https://dbgroup.cs.tsinghua.edu.cn/ligl/)

### Prof. Yuxiao Dong (董豫翔) — KEG Lab, Dept. of CS&T
- **Research**: Agent RL, graph representation learning. SIGKDD Rising Star 2022.
- **Key papers**:
  - **WebRL** (2024) — Self-evolving RL for web agents; Llama-3.1-8B improved from 4.8% to 42.4%. [OpenReview](https://openreview.net/forum?id=oVKEAFjEqv)
  - **AgentRL** (2025) — Scalable multi-turn agentic RL training. [OpenReview](https://openreview.net/forum?id=zq3vAmuUk9)
- **Homepage**: [keg.cs.tsinghua.edu.cn/yuxiao/](https://keg.cs.tsinghua.edu.cn/yuxiao/)

### Prof. Yuanchun Li (李元春) — AIR (Institute for AI Industry Research)
- **Research**: Personal LLM agents, mobile agents, on-device LLM
- **Key papers**:
  - **Personal LLM Agents Survey** (2024) — Capability, efficiency, security of personal agents on edge. [arXiv](https://arxiv.org/abs/2401.05459)
  - **AutoDroid** (MobiCom 2024) — LLM-powered Android automation.
  - **AutoDroid-V2** (MobiSys 2025, Best Artifact Award).
- **Homepage**: [yuanchun-li.github.io](https://yuanchun-li.github.io/)

### Prof. Minlie Huang (黄民烈) — CoAI Group, Dept. of CS&T
- **Research**: Conversational agents, dialogue systems, language generation
- **Key papers**: AgentBench co-author, CharacterGLM, SPaR (ICLR 2025).
- **Homepage**: [coai.cs.tsinghua.edu.cn/hml](https://coai.cs.tsinghua.edu.cn/hml)

### Prof. Chen Gao (高辰) — BNRist
- **Research**: Embodied agents, LLM-based simulation
- **Key papers**:
  - **SmartAgent** (AAAI 2026) — Chain-of-User-Thought for personalized agents. [arXiv](https://arxiv.org/abs/2412.07472)
  - **LLM Agent Simulation Survey** (Nature HSSC 2024). [Nature](https://www.nature.com/articles/s41599-024-03611-3)
- **Homepage**: [fi.ee.tsinghua.edu.cn/~gaochen/](https://fi.ee.tsinghua.edu.cn/~gaochen/)

### Dr. Zaiqing Nie (聂再清) — AIR
- **Research**: AI agents, evolvable intelligent agents
- **Key project**: **Agent Hospital** — Fully autonomous LLM-driven virtual hospital, 93% diagnostic accuracy.
- **Profile**: [AIR page](https://air.tsinghua.edu.cn/en/our_team/Research_Team/Professor.htm)

---

## 2. Sandboxing, Systems Security & Permission Models

*Overlaps with: WASM sandbox (wasmi, fuel metering), extension permission system, capability gating, signing/verification*

### Prof. Yu Jiang (蒋宇) — WingTecher Lab, School of Software
- **Research**: Software security, fuzzing, sandbox construction, runtime security
- **Key papers**:
  - **DynBox** (OOPSLA 2023) — Dynamic system call sandbox with partial order analysis. [GitHub](https://github.com/THU-WingTecher/DynBox) — **Directly relevant to extension sandboxing**
  - THANOS (ICSE 2025, Distinguished Paper), HEALER (SOSP 2021)
- **Homepage**: [sites.google.com/site/jiangyu198964/home](https://sites.google.com/site/jiangyu198964/home)

### Prof. Chao Zhang (张超) — NISL, Institute for Network Sciences & Cyberspace
- **Research**: Software security, control flow integrity, memory safety
- **Key papers**:
  - PACMem (CCS 2022) — Memory safety via ARM Pointer Authentication
  - EnclaveFuzz (NDSS 2024) — Finding SGX application vulnerabilities
  - Practical CFI (IEEE S&P 2013)
- **Homepage**: [netsec.ccert.edu.cn/people/chaoz/](https://netsec.ccert.edu.cn/people/chaoz/)

### Prof. Qi Li (李琦) — NISL, Institute for Network Sciences & Cyberspace
- **Research**: Permission models, cloud security, IoT security
- **Key papers**:
  - **PermHunter** — Comprehensive study of Android permission usage (ASIACCS) — **relevant to extension permission model**
  - SGX-Bouncer (ASIACCS 2021), Privilege-escalation vulnerability discovery
  - Group-based RBAC models (Computers & Security)
- **Homepage**: [sites.google.com/site/qili2012/](https://sites.google.com/site/qili2012/)

### Prof. Kang Chen (陈康) — MadSys Lab, Dept. of CS&T
- **Research**: Storage systems, trusted execution, software fault isolation
- **Key papers**:
  - **Occlum** (ASPLOS 2020) — SFI-based sandboxing within SGX enclaves. [PDF](https://madsys.cs.tsinghua.edu.cn/publication/occlum-secure-and-efficient-multitasking-inside-a-single-enclave-of-intel-sgx/ASPLOS20-shen.pdf) — **SFI is conceptually parallel to WASM's linear memory isolation**
  - HyperEnclave (USENIX ATC 2022)
- **Lab**: [madsys.cs.tsinghua.edu.cn](https://madsys.cs.tsinghua.edu.cn/)

### Prof. Jianjun Chen (陈建军) — NISL, Institute for Network Sciences & Cyberspace
- **Research**: Desktop application security, protocol security
- **Key papers**:
  - **Electron Security Study** (NDSS 2023) — Security of Electron apps + DOM sandboxing. [NDSS](https://www.ndss-symposium.org/ndss-paper/a-security-study-about-electron-applications-and-a-programming-methodology-to-tame-dom-functionalities/) — **Directly relevant to Tauri desktop security**
  - Cross-Origin attacks via HTTP/2 (NDSS 2025)
- **Homepage**: [jianjunchen.com](https://www.jianjunchen.com/)

### Prof. Haixin Duan (段海新) — NISL, Institute for Network Sciences & Cyberspace
- **Research**: DNS security, Web PKI, code signing
- **Key papers**:
  - **Code Signing Abuse Ecosystem** (NDSS 2026) — **Directly relevant to extension signing/verification**. [GitHub](https://github.com/XingTuLab/Code_Signing_Abuse_Dataset)
  - Rusted Anchors: Hidden Root CAs in Web PKI (CCS 2021)
- **Homepage**: [netsec.ccert.edu.cn/people/duanhx/](https://netsec.ccert.edu.cn/people/duanhx/)

---

## 3. Operating Systems, File Systems & Storage

*Overlaps with: File versioning, cloud sync, backup system, secure deletion, audit logging*

### Prof. Chen Yu (陈渝) — Dept. of CS&T
- **Research**: OS education, Rust systems programming, component-based OS
- **Key projects**:
  - **rCore** — Rust rewrite of teaching OS for RISC-V. [GitHub](https://github.com/rcore-os/rCore)
  - **ArceOS** — Modular/component-based OS in Rust — **analogous to Xplorer's plugin architecture**
- **Homepage**: [cs.tsinghua.edu.cn/info/1112/3500.htm](https://www.cs.tsinghua.edu.cn/info/1112/3500.htm)

### Prof. Jiwu Shu (舒继武) — Storage Lab, Dept. of CS&T
- **Research**: Storage security, NVM, data integrity
- **Key papers**:
  - **ShieldNVM** (ACM TOS 2020) — Secure NVM with crash consistency. [PDF](https://storage.cs.tsinghua.edu.cn/papers/tos20shieldnvm.pdf/)
  - HiNFS (EuroSys 2016) — High-performance NVM file system
  - Book: "Data Storage Architectures and Technologies" (Springer 2024)
- **Homepage**: [storage.cs.tsinghua.edu.cn/~jiwu-shu/](https://storage.cs.tsinghua.edu.cn/~jiwu-shu/)

### Prof. Youyou Lu (陆游游) — Storage Lab, Dept. of CS&T
- **Research**: Distributed file systems, metadata management
- **Key papers**:
  - **SingularFS** (USENIX ATC 2023) — Billion-scale distributed file system. [USENIX](https://www.usenix.org/conference/atc23/presentation/guo)
  - **InfiniFS** (FAST 2022) — Large-scale distributed FS metadata. [USENIX](https://www.usenix.org/conference/fast22/presentation/lv)
  - Octopus (USENIX ATC 2017) — RDMA persistent memory FS.
- **Homepage**: [storage.cs.tsinghua.edu.cn/~lu/](https://storage.cs.tsinghua.edu.cn/~lu/)

### Prof. Guangyan Zhang (张广艳) — Dept. of CS&T
- **Research**: Data integrity, corruption detection, storage reliability
- **Key papers**:
  - Silent Data Corruptions in Large Production CPU Population (SOSP 2023)
  - Dayu: Fast Data Recovery (USENIX ATC 2019)
- **Homepage**: [cs.tsinghua.edu.cn/csen/info/1301/4381.htm](https://www.cs.tsinghua.edu.cn/csen/info/1301/4381.htm)

---

## 4. Cryptography & Digital Signatures

*Overlaps with: Extension signing/verification, file encryption/decryption*

### Prof. Xiaoyun Wang (王小云) — IAS, Academician
- **Research**: Hash functions, digital signatures, post-quantum cryptography
- **Key achievements**: Broke MD5 and SHA-1. Designed SM3 (Chinese national standard, ISO/IEC since 2018).
- **Homepage**: [ias.tsinghua.edu.cn/en/info/1059/1173.htm](https://www.ias.tsinghua.edu.cn/en/info/1059/1173.htm)

### Yang Yu (喻杨) — IAS
- **Research**: Lattice-based signatures, post-quantum digital signatures
- **Key papers**:
  - Compact Lattice Gadget for Hash-and-Sign (CRYPTO 2023)
  - MITAKA: Parallelizable variant of Falcon (Eurocrypt 2022)
  - Gaussian Sampling for Signatures (Asiacrypt 2023, Best Paper)
- **Homepage**: [yuyang-crypto.github.io](https://yuyang-crypto.github.io/)

### Zhenzhen Bao (鲍郑珍) — Institute for Network Sciences & Cyberspace
- **Research**: Symmetric-key cryptography, AES, authenticated encryption
- **Key papers**:
  - XOCB: Beyond-birthday-bound authenticated encryption (Eurocrypt 2023)
  - New AES attack records (IACR 2026)
- **Homepage**: [freedisciplina.github.io](https://freedisciplina.github.io/)

---

## 5. Information Retrieval & Search

*Overlaps with: Xplorer's hybrid search pipeline (semantic + token + AI indexing)*

### Prof. Min Zhang (张敏) — THUIR, Dept. of CS&T
- **Research**: Web information retrieval, user behavior analysis, recommendation systems
- **Key venue**: Multiple awards at SIGIR 2024. Research covers search ranking, user modeling, cross-domain recommendation.
- **Homepage**: [thuir.cn/group/~mzhang/](http://www.thuir.cn/group/~mzhang/)

### Prof. Qingyao Ai (艾清遥) — THUIR, Dept. of CS&T
- **Research**: Information retrieval, retrieval-augmented generation, search ranking
- **Key work**: Dynamic retrieval-augmented generation, integrating retrieval with generative AI for information access agents — **directly relevant to Xplorer's AI-powered search**
- **Homepage**: [qingyaoai.github.io](https://qingyaoai.github.io/) | [ir.aiqingyao.org](https://ir.aiqingyao.org/)

---

## 6. HCI & Desktop Interaction

*Overlaps with: File manager UI, theming, context menus, accessibility, i18n*

### Prof. Chun Yu (喻纯) — PCG Lab, Dept. of CS&T
- **Research**: Desktop/mobile interaction, input techniques, AI-enhanced HCI
- **Key stats**: 80+ publications at CHI/UIST/UbiComp, 14 Best Paper/Honorable Mention awards. Research adopted by industry, reaching 600M+ users.
- **Lab areas**: Interface semantic understanding, interaction optimization, human-computer hybrid intelligence
- **Homepage**: [pi.cs.tsinghua.edu.cn/lab/people/ChunYu/](https://pi.cs.tsinghua.edu.cn/lab/people/ChunYu/)

### Prof. Yuanchun Shi (史元春) — PCG Lab, Dept. of CS&T
- **Research**: Pervasive computing, multimodal interfaces. Ranked #1 worldwide for HCI top-venue papers (CSRankings 2016-2021) together with Chun Yu.
- **Lab**: [pi.cs.tsinghua.edu.cn](https://pi.cs.tsinghua.edu.cn/)

### Yuntao Wang (王云涛) — PCG Lab, Dept. of CS&T
- **Research**: VR interaction, sensing, health monitoring
- **Key**: Wu Wenjun AI Outstanding Youth Award. CHI 2025 paper on VR training systems.
- **Homepage**: [pi.cs.tsinghua.edu.cn/lab/people/YuntaoWang/](https://pi.cs.tsinghua.edu.cn/lab/people/YuntaoWang/en/)

---

## 7. Software Architecture & Software Engineering

*Overlaps with: Extension ecosystem, plugin architecture, cross-platform development*

### Prof. Zheng Qin (覃征) — School of Software
- **Research**: Software architecture, formalized architecture description
- **Key works**: "Software Architecture" (Springer 2008), NSFC-funded research on flexible software architecture
- **Homepage**: [thss.tsinghua.edu.cn/en/faculty/zhengqin.htm](https://www.thss.tsinghua.edu.cn/en/faculty/zhengqin.htm)

### Min Zhou (周旻) — School of Software
- **Research**: Software verification, code clone detection
- **Key papers**: DSFM: Deep Subtree Interactions for code clone detection (ICSE 2024). Detected 300+ memory security issues in embedded systems.
- **Homepage**: [thss.tsinghua.edu.cn/en/faculty/minzhou.htm](https://www.thss.tsinghua.edu.cn/en/faculty/minzhou.htm)

---

## Top 10 Most Relevant to Xplorer (Ranked)

| Rank | Professor | Domain | Why It Matters for Xplorer |
|------|-----------|--------|---------------------------|
| 1 | **Zhiyuan Liu** | AI agents, tool use | ToolLLM & ChatDev directly inform Xplorer's Claude agent architecture |
| 2 | **Yu Jiang** | Dynamic sandboxing | DynBox (OOPSLA'23) is the closest published work to Xplorer's WASM extension sandbox |
| 3 | **Jie Tang** | GUI agents, agent evaluation | CogAgent for GUI + AgentBench for evaluation methodology |
| 4 | **Guoliang Li** | Data agents, NL2SQL | Data Agent vision matches Xplorer's NL-to-file-operations goal |
| 5 | **Jianjun Chen** | Desktop app security | Electron security study directly applicable to Tauri security model |
| 6 | **Haixin Duan** | Code signing security | NDSS'26 paper on code signing abuse = extension signing defense |
| 7 | **Kang Chen** | Software fault isolation | Occlum's SFI parallels WASM linear memory sandboxing |
| 8 | **Qingyao Ai** | Retrieval + generation | Dynamic RAG for search agents = Xplorer's AI-powered search |
| 9 | **Chun Yu** | Desktop HCI | World-leading file/desktop interaction research |
| 10 | **Yuanchun Li** | Personal device agents | On-device LLM agents = Xplorer's Ollama integration |

---

## Must-Read Papers (Top 15)

| # | Paper | Venue | Authors | Relevance |
|---|-------|-------|---------|-----------|
| 1 | ToolLLM: Facilitating LLMs to Master 16000+ APIs | ICLR 2024 | Qin, Liang, ..., Liu | Agent tool-use architecture |
| 2 | Building Dynamic System Call Sandbox (DynBox) | OOPSLA 2023 | Jiang et al. | Extension sandboxing |
| 3 | AgentBench: Evaluating LLMs as Agents | ICLR 2024 | Liu, Yu, ..., Tang | Agent evaluation framework |
| 4 | ChatDev: Communicative Agents for Software Development | ACL 2024 | Qian, ..., Liu, Sun | Multi-agent collaboration |
| 5 | Occlum: Secure Multitasking via SFI | ASPLOS 2020 | Shen, Tian, Chen, Chen | Memory-safe sandboxing |
| 6 | Electron Security Study + DOM Sandboxing | NDSS 2023 | Chen et al. | Desktop app security model |
| 7 | Code Signing Abuse Ecosystem | NDSS 2026 | Zhao, Zhang, ..., Duan | Extension signing security |
| 8 | CogAgent: Visual Language Model for GUI | CVPR 2024 | Hong, ..., Tang | GUI agent interaction |
| 9 | Data Agent: Holistic Data+AI Architecture | ICDE 2025 | Li | NL-to-data-operations |
| 10 | D-Bot: LLM-Powered Autonomous Diagnosis | VLDB 2024 | Zhou, ..., Li | Autonomous agent planning |
| 11 | Personal LLM Agents: Insights and Survey | 2024 | Li et al. | On-device agent architecture |
| 12 | WebRL: Self-Evolving RL for Web Agents | 2024 | Qi, ..., Dong | Agent self-improvement |
| 13 | AgentVerse: Multi-Agent Collaboration | ICLR 2024 | Chen, ..., Liu | Agent coordination patterns |
| 14 | SingularFS: Billion-Scale Distributed FS | ATC 2023 | Guo, ..., Lu | Scalable file metadata |
| 15 | ShieldNVM: Secure Storage with Crash Consistency | TOS 2020 | Yang, ..., Shu | Secure file storage |
