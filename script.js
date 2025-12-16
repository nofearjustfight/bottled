import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const messageInput = document.getElementById('message');
    const themeButtons = document.querySelectorAll('.theme-btn');
    const bottleButtons = document.querySelectorAll('.bottle-btn');
    const messageBottlePreview = document.querySelector('.message-bottle-preview');
    const sealButton = document.getElementById('seal-bottle');
    const confirmationModal = document.getElementById('confirmation');
    const closeConfirmation = document.getElementById('close-confirmation');
    const senderEmailModal = document.getElementById('sender-email-modal');
    const senderEmailInput = document.getElementById('sender-email');
    const confirmSendButton = document.getElementById('confirm-send');
    const recipientEmail = document.getElementById('recipient-email');
    const deliveryDate = document.getElementById('delivery-date');
    
    // Set minimum date to tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    deliveryDate.min = minDate;

    // Bottle selection (Design Your Bottle)
    let selectedBottleColor = '#3498db';

    const applyBottleColor = (color) => {
        selectedBottleColor = color;
        if (messageBottlePreview) {
            messageBottlePreview.style.setProperty('--bottle-color', color);
        }
    };

    const setDefaultBottle = () => {
        const defaultBtn = document.querySelector('.bottle-btn[data-color="#3498db"]');
        bottleButtons.forEach(btn => btn.classList.remove('is-selected'));
        if (defaultBtn) {
            defaultBtn.classList.add('is-selected');
            applyBottleColor('#3498db');
        } else if (bottleButtons.length) {
            bottleButtons[0].classList.add('is-selected');
            const color = bottleButtons[0].getAttribute('data-color') || '#3498db';
            applyBottleColor(color);
        }
    };

    if (bottleButtons.length) {
        const preselected = document.querySelector('.bottle-btn.is-selected');
        if (preselected) {
            const color = preselected.getAttribute('data-color') || '#3498db';
            applyBottleColor(color);
        } else {
            setDefaultBottle();
        }

        bottleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                bottleButtons.forEach(b => b.classList.remove('is-selected'));
                btn.classList.add('is-selected');
                const color = btn.getAttribute('data-color') || '#3498db';
                applyBottleColor(color);
            });
        });
    }
    
    // Theme switching functionality
    themeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            themeButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Remove all theme classes from body
            document.body.classList.remove('theme-parchment', 'theme-ledger');
            
            // Add selected theme class to body
            const theme = this.getAttribute('data-theme');
            document.body.classList.add(`theme-${theme}`);
            
            // Update textarea placeholder based on theme
            if (theme === 'parchment') {
                messageInput.placeholder = 'My Dearest...';
            } else {
                messageInput.placeholder = 'To Whom It May Concern...';
            }
            
            // Focus on the message area
            messageInput.focus();
        });
    });
    
    // Form submission - show sender email modal first
    sealButton.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Basic form validation
        if (!recipientEmail.value) {
            alert('Please enter a recipient email');
            recipientEmail.focus();
            return;
        }
        
        if (!deliveryDate.value) {
            alert('Please select a delivery date');
            deliveryDate.focus();
            return;
        }
        
        if (!messageInput.value.trim()) {
            alert('Please write your message');
            messageInput.focus();
            return;
        }
        
        // Show sender email modal (data NOT saved yet)
        senderEmailModal.style.display = 'flex';
        senderEmailInput.value = '';
        senderEmailInput.focus();
    });
    
    // Sender email modal - Confirm & Send button
    confirmSendButton.addEventListener('click', async function() {
        const senderEmail = senderEmailInput.value.trim();
        
        // Validate sender email
        if (!senderEmail) {
            alert('Please enter your email address');
            senderEmailInput.focus();
            return;
        }
        
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(senderEmail)) {
            alert('Please enter a valid email address');
            senderEmailInput.focus();
            return;
        }
        
        // Insert into Supabase with sender_email
        const { data, error } = await supabase
            .from('bottles')
            .insert({
                sender_email: senderEmail,
                recipient_email: recipientEmail.value,
                message: messageInput.value,
                delivery_date: deliveryDate.value,
                theme: document.body.classList.contains('theme-parchment') ? 'parchment' : 'ledger',
                bottle_color: selectedBottleColor
            });
        
        if (error) {
            alert('Error saving message: ' + error.message);
            return;
        }
        
        // Send confirmation email via Edge Function
        try {
            const emailResponse = await fetch('https://ahjcyqdprqczhlvlwlgi.supabase.co/functions/v1/send-confirmation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    senderEmail: senderEmail,
                    recipientEmail: recipientEmail.value,
                    deliveryDate: deliveryDate.value,
                    bottleColor: selectedBottleColor,
                    theme: document.body.classList.contains('theme-parchment') ? 'parchment' : 'ledger'
                })
            });
            
            if (!emailResponse.ok) {
                console.error('Failed to send confirmation email');
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError);
        }
        
        // Close sender email modal, show success confirmation
        senderEmailModal.style.display = 'none';
        showConfirmation();
    });
    
    // Show confirmation modal
    function showConfirmation() {
        confirmationModal.style.display = 'flex';
    }
    
    // Close confirmation modal
    closeConfirmation.addEventListener('click', function() {
        confirmationModal.style.display = 'none';
        
        // Reset form
        document.querySelector('form')?.reset();
        messageInput.value = '';
        document.body.classList.remove('theme-parchment', 'theme-ledger');
        themeButtons.forEach(btn => btn.classList.remove('active'));
        if (bottleButtons.length) {
            setDefaultBottle();
        }
    });
    
    // Close modal when clicking outside the content
    window.addEventListener('click', function(e) {
        if (e.target === confirmationModal) {
            confirmationModal.style.display = 'none';
        }
        // Close sender email modal when clicking outside (form data preserved)
        if (e.target === senderEmailModal) {
            senderEmailModal.style.display = 'none';
        }
    });
    
    // Auto-expand textarea as user types
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Testimonials carousel (5 at a time)
    const testimonialsTrack = document.querySelector('.testimonials .carousel-track');
    const testimonialsPrev = document.getElementById('testimonials-prev');
    const testimonialsNext = document.getElementById('testimonials-next');
    const testimonialsDots = document.querySelectorAll('.testimonials .carousel-dot');

    if (testimonialsTrack && testimonialsPrev && testimonialsNext && testimonialsDots.length) {
        const pages = testimonialsTrack.querySelectorAll('.carousel-page');
        let index = 0;

        const renderTestimonials = () => {
            index = Math.max(0, Math.min(index, pages.length - 1));
            testimonialsTrack.style.transform = `translateX(-${index * 50}%)`;
            testimonialsTrack.setAttribute('data-index', String(index));
            testimonialsDots.forEach((d, i) => d.classList.toggle('is-active', i === index));
        };

        testimonialsPrev.addEventListener('click', () => {
            index = (index - 1 + pages.length) % pages.length;
            renderTestimonials();
        });

        testimonialsNext.addEventListener('click', () => {
            index = (index + 1) % pages.length;
            renderTestimonials();
        });

        testimonialsDots.forEach(dot => {
            dot.addEventListener('click', () => {
                const nextIndex = Number(dot.getAttribute('data-index'));
                if (!Number.isNaN(nextIndex)) {
                    index = nextIndex;
                    renderTestimonials();
                }
            });
        });

        renderTestimonials();
    }
    
    // Initialize with first theme selected by default
    if (themeButtons.length > 0) {
        themeButtons[0].click();
    }
});
