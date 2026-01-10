// Configuration - Replace with your actual Gist ID
const GIST_ID = '41bbbc3a835e6ba76c65fcb57afa0a22'; // ←←← REPLACE THIS WITH YOUR ACTUAL GIST ID

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const mainNav = document.getElementById('mainNav');

if (mobileMenuToggle && mainNav) {
    mobileMenuToggle.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        const icon = mobileMenuToggle.querySelector('i');
        if (mainNav.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

// Fetch data from GitHub Gist
async function fetchGistData() {
    try {
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch  ${response.status}`);
        }
        
        const gist = await response.json();
        const fileContent = Object.values(gist.files)[0].content;
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('Error fetching Gist ', error);
        // Return default data if fetch fails
        return {
            announcements: [
                {
                    id: 1,
                    text: "🚀 Welcome to Gyrobotics! Our platform helps students learn by building.",
                    link: "#",
                    linkText: "Get Started"
                }
            ],
            tools: [
                {
                    id: 1,
                    name: "BuildBot Kit",
                    description: "Modular robotics kit for students to design, build, and program their own robots.",
                    icon: "fas fa-robot",
                    detailPage: "tools/buildbot-kit.html",
                    downloads: [
                        {
                            name: "User Guide",
                            file: "downloads/buildbot-guide.pdf",
                            type: "pdf",
                            size: "2.4 MB"
                        }
                    ]
                }
            ]
        };
    }
}

// Get icon for file type
function getFileIcon(fileType) {
    const icons = {
        'pdf': 'fas fa-file-pdf',
        'zip': 'fas fa-file-archive',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'txt': 'fas fa-file-alt',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'mp4': 'fas fa-file-video',
        'avi': 'fas fa-file-video',
        'mov': 'fas fa-file-video',
        'default': 'fas fa-file'
    };
    return icons[fileType] || icons['default'];
}

// Render Scrolling Announcements
async function renderAnnouncements() {
    const container = document.getElementById('announcementContent');
    if (!container) return;
    
    const data = await fetchGistData();
    const announcements = data.announcements || [];
    
    if (announcements.length === 0) {
        container.innerHTML = '<div class="announcement-item"><span class="announcement-text">No announcements available</span></div>';
        return;
    }
    
    container.innerHTML = '';
    
    announcements.forEach(announcement => {
        const item = document.createElement('div');
        item.className = 'announcement-item';
        item.innerHTML = `
            <span class="announcement-text">${announcement.text}</span>
            ${announcement.link ? `<a href="${announcement.link}" class="announcement-link">${announcement.linkText || 'Learn More'}</a>` : ''}
        `;
        container.appendChild(item);
    });
    
    // Restart animation to ensure smooth scrolling
    container.style.animation = 'none';
    setTimeout(() => {
        container.style.animation = 'scroll-left 30s linear infinite';
    }, 10);
}

// Render Tools with Download Buttons
async function renderTools() {
    const toolsGrid = document.getElementById('toolsGrid');
    if (!toolsGrid) return;
    
    const data = await fetchGistData();
    const tools = data.tools || [];
    
    if (tools.length === 0) {
        toolsGrid.innerHTML = '<div class="tool-card"><div class="tool-content"><h3 class="tool-title">No tools available</h3></div></div>';
        return;
    }
    
    toolsGrid.innerHTML = '';
    
    tools.forEach(tool => {
        // Create primary download button (first download or generic)
        const primaryDownload = tool.downloads && tool.downloads.length > 0 
            ? tool.downloads[0] 
            : { name: "Download Resources", file: "#" };
            
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card';
        toolCard.innerHTML = `
            <div class="tool-image">
                <i class="${tool.icon}"></i>
            </div>
            <div class="tool-content">
                <h3 class="tool-title">${tool.name}</h3>
                <p class="tool-description">${tool.description}</p>
                <div class="download-section">
                    <a href="${primaryDownload.file}" class="download-primary">
                        <i class="${getFileIcon(primaryDownload.type)}"></i>
                        ${primaryDownload.name}
                    </a>
                    ${tool.downloads && tool.downloads.length > 1 ? 
                        `<button class="download-more-btn" data-tool-id="${tool.id}">
                            <i class="fas fa-chevron-down"></i> ${tool.downloads.length - 1} more
                        </button>` : ''
                    }
                </div>
            </div>
        `;
        
        // Add click event to navigate to detail page (except on download links/buttons)
        toolCard.addEventListener('click', (e) => {
            if (e.target.closest('.download-primary') || e.target.closest('.download-more-btn')) {
                e.stopPropagation();
                return;
            }
            window.location.href = tool.detailPage;
        });
        
        toolsGrid.appendChild(toolCard);
    });
    
    // Add event listeners for "more downloads" buttons
    document.querySelectorAll('.download-more-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const toolId = parseInt(e.currentTarget.getAttribute('data-tool-id'));
            showAllDownloads(toolId);
        });
    });
}

// Show all downloads for a tool in a modal
async function showAllDownloads(toolId) {
    const data = await fetchGistData();
    const tool = data.tools.find(t => t.id === toolId);
    
    if (!tool || !tool.downloads || tool.downloads.length === 0) return;
    
    // Get modal elements
    const modal = document.getElementById('downloadsModal');
    const modalToolName = document.getElementById('modalToolName');
    const downloadsList = document.getElementById('downloadsList');
    
    // Set modal title
    modalToolName.textContent = `${tool.name} Downloads`;
    
    // Populate downloads list
    downloadsList.innerHTML = '';
    
    tool.downloads.forEach(download => {
        const downloadItem = document.createElement('div');
        downloadItem.className = 'download-item';
        downloadItem.innerHTML = `
            <a href="${download.file}" class="download-link">
                <div class="download-icon">
                    <i class="${getFileIcon(download.type)}"></i>
                </div>
                <div class="download-info">
                    <div class="download-name">${download.name}</div>
                    <div class="download-meta">${download.size || ''} • ${download.type.toUpperCase()}</div>
                </div>
                <div class="download-action">
                    <i class="fas fa-download"></i>
                </div>
            </a>
        `;
        downloadsList.appendChild(downloadItem);
    });
    
    // Show modal
    modal.style.display = 'flex';
    
    // Close modal functionality
    const closeModal = modal.querySelector('.close-modal');
    closeModal.onclick = () => {
        modal.style.display = 'none';
    };
    
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    renderAnnouncements();
    renderTools();
    
    // Smooth Scrolling for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
});