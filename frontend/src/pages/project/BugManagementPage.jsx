import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import projectApi from '@/api/project';
import BugManagementView from './components/BugManagementModal';

export default function BugManagementPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        projectApi.getProject(id).then(res => { if (active) setProject(res.data); })
            .catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [id]);
    if (error) return <div role="alert">{error}</div>;
    if (!project) return <div>加载中...</div>;
    return <BugManagementView isOpen asPage project={project} onClose={() => navigate(`/project/${id}`)} />;
}
