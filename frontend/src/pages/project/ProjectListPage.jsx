import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import projectApi from '@/api/project';

export default function ProjectListPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const response = await projectApi.listProjects();
            // Should adjust based on actual API response format (items usually inside data)
            setProjects(response.data?.items || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load projects');
            console.error('Error loading projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleProjectClick = (projectId) => {
        navigate(`/project/${projectId}`);
    };

    if (loading) return <div className="page-content"><div className="loading">Loading projects...</div></div>;
    if (error) return <div className="page-content"><div className="error">Error: {error}</div></div>;

    return (
        <div className="page-content">
            <div className="toolbar">
                <button className="btn btn-primary">Create Project</button>
            </div>

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Project No.</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>PM</th>
                            <th>Start Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No projects found. Click "Create Project" to create one.
                                </td>
                            </tr>
                        ) : (
                            projects.map(project => (
                                <tr key={project.id} onClick={() => handleProjectClick(project.id)} style={{ cursor: 'pointer' }}>
                                    <td>{project.project_no}</td>
                                    <td>{project.name}</td>
                                    <td><span className="badge">{project.project_type}</span></td>
                                    <td>{project.pm_name || project.pm_user_id}</td>
                                    <td>{project.start_at || '-'}</td>
                                    <td><span className={`status-badge ${project.status}`}>{project.status}</span></td>
                                    <td>
                                        <button
                                            className="btn-link"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProjectClick(project.id);
                                            }}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
