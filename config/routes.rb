Rails.application.routes.draw do
  root 'map#index'
  get  'check_region' => 'map#check_region'
  get  'create_isochrone' => 'map#create_isochrone'

  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
