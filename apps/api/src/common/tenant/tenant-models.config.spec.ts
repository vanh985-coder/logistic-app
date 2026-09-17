import {
  validateAllModelsClassified,
  TENANT_MODELS,
  TENANT_SELF_MODELS,
  TENANT_RELATION_MODELS,
  GLOBAL_MODELS,
} from './tenant-models.config';

describe('TenantModelsConfig - Fail Fast Bootstrap Validation', () => {
  it('should pass when all models are classified', () => {
    const knownModels = [
      'Company',
      'User',
      'RefreshToken',
      'Lane',
      'PricingConfig',
      'Shipment',
      'Package',
      'ContainerType',
      'MatchGroup',
      'MatchGroupShipment',
    ];
    expect(() =>
      validateAllModelsClassified(
        knownModels,
        TENANT_MODELS,
        TENANT_SELF_MODELS,
        TENANT_RELATION_MODELS,
        GLOBAL_MODELS,
      ),
    ).not.toThrow();
  });

  it('should THROW immediately when an unclassified model is detected in DMMF', () => {
    const unclassifiedModels = ['User', 'RefreshToken', 'Company', 'NewUnclassifiedOrder'];
    expect(() =>
      validateAllModelsClassified(
        unclassifiedModels,
        TENANT_MODELS,
        TENANT_SELF_MODELS,
        TENANT_RELATION_MODELS,
        GLOBAL_MODELS,
      ),
    ).toThrowError(/NewUnclassifiedOrder/);
  });
});

