/**
 * S6-03: Invitar Staff
 * Lógica controladora para la vista Equipo (Gestión de roles y miembros)
 */

export function bootStaffSection() {
    const section = document.getElementById('staff');
    if (!section) return;

    const btnInviteStaff = document.getElementById('btnInviteStaff');
    const overlay = document.getElementById('staffInviteOverlay');
    const btnCancel = document.getElementById('btnStaffInvCancel');
    const btnSubmit = document.getElementById('btnStaffInvSubmit');
    const listBody = document.getElementById('staffListBody');

    // Mocks initial staff
    const staffMembers = [
        { name: 'Dr. Hermano Caiza', role: 'admin', contact: 'admin@auroraderm.com', status: 'Activo' }
    ];

    function renderList() {
        listBody.innerHTML = '';
        if (staffMembers.length === 0) {
            listBody.innerHTML = `<tr><td colspan="4" style="padding:16px; text-align:center; color:var(--admin-text-muted);">No hay miembros registrados.</td></tr>`;
            return;
        }

        staffMembers.forEach(member => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--admin-border)';
            tr.innerHTML = `
                <td style="padding:12px; font-weight:500;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:24px; height:24px; border-radius:50%; background:var(--admin-accent); color:var(--admin-bg-surface); display:flex; align-items:center; justify-content:center; font-size:0.75rem;">
                            ${member.name.charAt(0).toUpperCase()}
                        </div>
                        ${member.name}
                    </div>
                </td>
                <td style="padding:12px;"><span style="background:var(--admin-surface-hover); padding:4px 8px; border-radius:4px; font-size:0.8rem;">${member.role}</span></td>
                <td style="padding:12px; color:var(--admin-text-muted); font-size:0.9rem;">${member.contact}</td>
                <td style="padding:12px;">
                    <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.85rem; color:${member.status === 'Activo' ? 'var(--admin-success)' : 'var(--admin-accent)'}">
                        <div style="width:6px; height:6px; border-radius:50%; background:currentColor;"></div>
                        ${member.status}
                    </span>
                </td>
            `;
            listBody.appendChild(tr);
        });
    }

    btnInviteStaff.addEventListener('click', () => {
        document.getElementById('staffInvName').value = '';
        document.getElementById('staffInvContact').value = '';
        document.getElementById('staffInvRole').value = 'doctor';
        overlay.style.display = 'flex';
    });

    btnCancel.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    btnSubmit.addEventListener('click', () => {
        const name = document.getElementById('staffInvName').value.trim();
        const contact = document.getElementById('staffInvContact').value.trim();
        const role = document.getElementById('staffInvRole').value;

        if (!name || !contact) {
            alert('Por favor ingresa nombre y contacto.');
            return;
        }

        btnSubmit.textContent = 'Enviando...';
        btnSubmit.disabled = true;

        // Simulamos envío al endpoint POST /api.php?action=invite-staff
        setTimeout(() => {
            staffMembers.push({
                name,
                role,
                contact,
                status: 'Invitación Pendiente'
            });
            renderList();
            
            overlay.style.display = 'none';
            btnSubmit.textContent = 'Enviar Invitación';
            btnSubmit.disabled = false;
            
            // Dispatch success toast/event
            document.body.dispatchEvent(new CustomEvent('admin-toast', {
                detail: { message: `Invitación enviada exitosamente a ${name}`, type: 'success' }
            }));
        }, 800);
    });

    // Render inicial
    renderList();
}
