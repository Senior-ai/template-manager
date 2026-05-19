document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const gvcDateInput = document.getElementById('gvc-date');
    const templateContent = document.getElementById('template-content');
    const timezoneSelect = document.getElementById('timezone-select');
    const startTimeSelect = document.getElementById('start-time');
    const endTimeSelect = document.getElementById('end-time');
    const workingDaysSelect = document.getElementById('working-days');
    const agentNameInput = document.getElementById('agent-name');
    const templateButtons = document.querySelectorAll('.template-button');
    const copyButton = document.getElementById('copy-template');
    const fullSignatureCheckbox = document.getElementById('full-signature-checkbox');

    let currentCategory = 'general';
    const today = new Date().toISOString().split('T')[0];
    gvcDateInput.value = today;

    const savedTimezoneIndex = localStorage.getItem('timezoneIndex');
    if (savedTimezoneIndex !== null && timezoneSelect.options[savedTimezoneIndex]) {
        timezoneSelect.selectedIndex = parseInt(savedTimezoneIndex, 10);
    }
    workingDaysSelect.value = localStorage.getItem('workingDays') || 'Sun-Thu';
    agentNameInput.value = localStorage.getItem('agentName') || '';
    startTimeSelect.value = localStorage.getItem('startTime') || startTimeSelect.value;
    endTimeSelect.value = localStorage.getItem('endTime') || endTimeSelect.value;
    if (fullSignatureCheckbox) {
        const savedFullSig = localStorage.getItem('fullSignature');
        if (savedFullSig !== null) {
            fullSignatureCheckbox.checked = savedFullSig === 'true';
        }
    }

    // Store the original template text
    let originalTemplate = '';

    function generateTimeSlots(date, utcOffset) {
        // Parse the input date
        const selectedDate = new Date(date);
        
        // Create arrays for both days
        const timeSlots = [];
        
        // Generate slots for both days
        for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
            const currentDate = new Date(selectedDate);
            currentDate.setDate(selectedDate.getDate() + dayOffset);
            
            // Format the date as "Day, Month Day, Year"
            const formattedDate = currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            
            // Get start and end times from the select elements
            const startTime = startTimeSelect.value;
            const endTime = endTimeSelect.value;
            
            // Parse hours and minutes
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            
            // Convert to total minutes for easier calculation
            let currentMinutes = startHour * 60 + startMinute;
            const endMinutes = endHour * 60 + endMinute;
            
            // Generate time slots for the day
            while (currentMinutes < endMinutes) {
                const currentHour = Math.floor(currentMinutes / 60);
                const currentMin = currentMinutes % 60;
                
                // Format the current time
                const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
                
                // Calculate next time (30 minutes later)
                const nextMinutes = currentMinutes + 30;
                const nextHour = Math.floor(nextMinutes / 60);
                const nextMin = nextMinutes % 60;
                const nextTime = `${nextHour.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`;
                
                timeSlots.push(`${formattedDate}, ${currentTime}-${nextTime} ${utcOffset}`);
                
                // Move to next slot
                currentMinutes = nextMinutes;
            }
        }
        
        return timeSlots.join('\n');
    }

    function updateTimeAvailability() {
        const date = gvcDateInput.value;
        const timezoneText = timezoneSelect.options[timezoneSelect.selectedIndex].text;
        const utcOffset = timezoneText.match(/UTC[+-]\d+(?::\d+)?/)[0];
        
        const timeSlots = generateTimeSlots(date, utcOffset);
        
        // Update the template content with time slots
        if (templateContent.value.includes('[TIME_AVAILABILITY]')) {
            templateContent.value = templateContent.value.replace('[TIME_AVAILABILITY]', timeSlots);
        }
    }

    function replacePlaceholders(templateText) {
        const timezoneText = timezoneSelect.options[timezoneSelect.selectedIndex].text;
        const timezoneValue = timezoneSelect.value;
        const startTime = startTimeSelect.value;
        const endTime = endTimeSelect.value;
        const workingDays = workingDaysSelect.value;
        const agentName = agentNameInput.value.trim();
        const cityMatch = timezoneText.match(/\((.*?)\)/);
        let cityName = cityMatch ? cityMatch[1] : '[CITY]';
        
        // Extract just the UTC part from the timezone
        const utcMatch = timezoneText.match(/UTC[+-]\d+(?::\d+)?/);
        const utcValue = utcMatch ? utcMatch[0] : '[TIMEZONE]';
        
        // Store the original city name for timezone display
        const originalCityName = cityName;
        
        // Replace Jerusalem with Tel-Aviv only for the city name display
        if (cityName === 'Jerusalem') {
            cityName = 'Tel-Aviv';
        }

        // Capitalize first letter of agent name
        const formattedAgentName = agentName ? agentName.charAt(0).toUpperCase() + agentName.slice(1) : '[Your Name]';

        // Check if minimal signature is requested
        const useFullSignature = fullSignatureCheckbox ? fullSignatureCheckbox.checked : true;

        let updatedText = templateText;
        if (!useFullSignature) {
            // Replace only the signature block (from [Your Name] to the end of the signature)
            updatedText = updatedText.replace(/\[Your Name\][^\n]*\nGoogle Cloud Platform (?:Support|support),? ?\[CITY\][^\n]*\nWorking Hours: ?\[WORKING_DAYS\] ?\[START_TIME\] - \[END_TIME\](?: ?\[CITY\] Timezone ?\(\[TIMEZONE\]\))?/gmi,
                `${formattedAgentName}\nGoogle Cloud Platform Support\nWorking Hours: ${workingDays} ${startTime} - ${endTime}`
            );
            updatedText = updatedText.replace(/\[Your Name\][^\n]*\nGoogle Cloud Platform (?:Support|support)[^\n]*\nWorking Hours: ?\[WORKING_DAYS\] ?\[START_TIME\] - \[END_TIME\][^\n]*/gmi,
                `${formattedAgentName}\nGoogle Cloud Platform Support\nWorking Hours: ${workingDays} ${startTime} - ${endTime}`
            );
            // Fallback: only if [Your Name] is still present and minimal signature is not already present
            if (updatedText.includes('[Your Name]') && !updatedText.includes('Google Cloud Platform Support\nWorking Hours:')) {
                updatedText = updatedText.replace(/\[Your Name\]/g, `${formattedAgentName}\nGoogle Cloud Platform Support\nWorking Hours: ${workingDays} ${startTime} - ${endTime}`);
            }
            // Always replace [TIME_AVAILABILITY] if present
            if (updatedText.includes('[TIME_AVAILABILITY]')) {
                const date = gvcDateInput.value;
                const utcOffset = timezoneText.match(/UTC[+-]\d+(?::\d+)?/)[0];
                const timeSlots = generateTimeSlots(date, utcOffset);
                updatedText = updatedText.replace('[TIME_AVAILABILITY]', timeSlots);
            }
        } else {
            updatedText = updatedText
                .replace(/\[CITY\]/g, cityName)
                .replace(/\[TIMEZONE\]/g, utcValue)
                .replace(/\[WORKING_DAYS\]/g, workingDays)
                .replace(/\[START_TIME\]/g, startTime)
                .replace(/\[END_TIME\]/g, endTime)
                .replace(/\[Your Name\]/g, formattedAgentName)
                .replace(/\[SCHEDULED_DATE\]/g, (() => {
                    const date = new Date(gvcDateInput.value);
                    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
                })())
                .replace(/\[FORMATTED_DATE\]/g, (() => {
                    const date = new Date(gvcDateInput.value);
                    return date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                    });
                })());
            // Handle the timezone text separately to maintain Jerusalem in the timezone part
            if (originalCityName === 'Jerusalem') {
                updatedText = updatedText.replace(/Tel-Aviv Timezone/g, 'Jerusalem Timezone');
            }
            // If the template contains time availability, update it
            if (updatedText.includes('[TIME_AVAILABILITY]')) {
                const date = gvcDateInput.value;
                const utcOffset = timezoneText.match(/UTC[+-]\d+(?::\d+)?/)[0];
                const timeSlots = generateTimeSlots(date, utcOffset);
                updatedText = updatedText.replace('[TIME_AVAILABILITY]', timeSlots);
            }
        }
        return updatedText;
    }

    function updateSignature() {
        console.log('Updating signature...');
        if (templateContent.value) {
            if (originalTemplate) {
                templateContent.value = replacePlaceholders(originalTemplate);
            } else {
                templateContent.value = replacePlaceholders(templateContent.value);
            }
        }
    }

    function updateTemplateContent() {
        if (templateContent.value) {
            templateContent.value = replacePlaceholders(originalTemplate || templateContent.value);
            console.log('Updated template:', templateContent.value);
        }
    }

    const storageKeyById = {
        'timezone-select': 'timezoneIndex',
        'start-time': 'startTime',
        'end-time': 'endTime',
        'working-days': 'workingDays',
        'agent-name': 'agentName',
        'gvc-date': 'gvcDate',
    };

    // Trigger update whenever any of these fields change
    [timezoneSelect, startTimeSelect, endTimeSelect, workingDaysSelect, agentNameInput, gvcDateInput].forEach(el => {
        el.addEventListener('change', () => {
            console.log(`Updated value for ${el.id}:`, el.value);
            updateSignature();
            updateTemplateContent();
            const key = storageKeyById[el.id];
            if (key) {
                const valueToStore = el === timezoneSelect ? String(el.selectedIndex) : el.value;
                localStorage.setItem(key, valueToStore);
            }
        });
    });

    // Initialize with the current stored values
    updateSignature();

    function activateTab(tab, { clearTemplate = true } = {}) {
        currentCategory = tab;

        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });

        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tab);
        });

        gvcDateInput.style.display = tab === 'gvc' ? 'block' : 'none';
        if (clearTemplate) {
            templateContent.value = '';
        }
    }

    // Tab switching logic
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.getAttribute('data-tab');
            activateTab(tab);
            localStorage.setItem('activeTab', tab);
        });
    });

    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && document.querySelector(`.tab-button[data-tab="${savedTab}"]`)) {
        activateTab(savedTab, { clearTemplate: false });
    }

    // Handle template button clicks
    templateButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const templateName = button.getAttribute('data-template');
            console.log(`Selected template: ${templateName}`);

            templateButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            try {
                const res = await fetch(`/get_template/${currentCategory}/${templateName}`);
                const data = await res.json();
                if (data.error) return alert('Template not found');

                // Store the original template
                originalTemplate = data;
                templateContent.value = replacePlaceholders(data);
                updateTemplateContent();
            } catch (err) {
                console.error('Error loading template:', err);
                alert('Error loading template');
            }
        });
    });

    // Copy to clipboard
    copyButton.addEventListener('click', async () => {
        const textToCopy = templateContent.value;
        
        if (!textToCopy) {
            alert('No template content to copy!');
            return;
        }

        try {
            // Try using the modern Clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                // Fallback for older browsers or non-secure contexts
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                    alert('Failed to copy template. Please try selecting and copying manually.');
                }
                
                textArea.remove();
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy template. Please try selecting and copying manually.');
        }
    });

    // Handle agent name input change
    agentNameInput.addEventListener('input', function() {
        const newName = this.value.trim();
        console.log(`Agent name changed to: ${newName}`);

        localStorage.setItem('agentName', newName);
        updateSignature();
        updateTemplateContent();
    });

    // Initialize template content on load
    updateTemplateContent();

    // Add event listener to update template when checkbox changes
    if (fullSignatureCheckbox) {
        fullSignatureCheckbox.addEventListener('change', () => {
            localStorage.setItem('fullSignature', fullSignatureCheckbox.checked);
            updateSignature();
            updateTemplateContent();
        });
    }
});
